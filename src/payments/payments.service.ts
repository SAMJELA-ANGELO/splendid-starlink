import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { UsersService } from '../users/users.service';
import { PlansService } from '../plans/plans.service';
import { MikrotikService } from '../mikrotik/mikrotik.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private usersService: UsersService,
    private plansService: PlansService,
    private mikrotikService: MikrotikService,
    private configService: ConfigService,
  ) {}

  async initiatePayment(
    userId: string,
    planId: string,
    email?: string,
    phone?: string,
    externalId?: string,
    name?: string,
  ) {
    const plan = await this.plansService.findById(planId);
    if (!plan) throw new Error('Plan not found');

    // Validation
    if (!phone) throw new Error('Phone number is required for direct payment');
    if (!Number.isInteger(plan.price)) {
      throw new Error('Amount must be an integer');
    }
    if (plan.price < 100) {
      throw new Error('Amount cannot be less than 100 XAF');
    }

    // Build request payload for directPay
    const paymentData: any = {
      amount: plan.price + plan.price * 0.04,
      phone: phone,
      userId: userId,
    };

    if (email) paymentData.email = email;
    if (externalId) paymentData.externalId = externalId;
    if (name) paymentData.name = name;

    // Call Fapshi API directPay endpoint (sends payment to mobile)
    const fapshiResponse = await axios.post(
      `${this.configService.get('FAPSHI_BASE_URL')}/direct-pay`,
      paymentData,
      {
        headers: {
          'Content-Type': 'application/json',
          apiuser: this.configService.get('FAPSHI_APIUSER'),
          apikey: this.configService.get('FAPSHI_APIKEY'),
        },
        timeout: 10000,
      },
    );

    // Create and save payment record
    const payment = new this.paymentModel({
      userId,
      planId,
      amount: plan.price,
      email,
      phone,
      externalId,
      status: (fapshiResponse.data.status || 'created').toLowerCase(),
      fapshiTransactionId: fapshiResponse.data.transId,
      fapshiResponse: fapshiResponse.data,
    });
    await payment.save();

    return {
      paymentId: payment._id,
      transId: fapshiResponse.data.transId,
      message: 'Payment request sent to your mobile phone. Please complete payment on your device.',
    };
  }

  async checkPaymentStatus(transactionId: string) {
    try {
      const response = await axios.get(
        `${this.configService.get('FAPSHI_BASE_URL')}/payment-status/${transactionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            apiuser: this.configService.get('FAPSHI_APIUSER'),
            apikey: this.configService.get('FAPSHI_APIKEY'),
          },
          timeout: 10000,
        },
      );

      const payment = await this.paymentModel.findOne({
        fapshiTransactionId: transactionId,
      });
      if (!payment) return response.data;

      // Update payment status (normalize to enum: lowercase for initial states)
      const statusValue = response.data.status;
      payment.status = statusValue && ['created', 'pending'].includes(statusValue.toLowerCase())
        ? statusValue.toLowerCase()
        : statusValue;
      payment.fapshiResponse = response.data;
      await payment.save();

      // Activate user if payment succeeded
      if (response.data.status === 'SUCCESSFUL') {
        const plan = await this.plansService.findById(payment.planId);
        if (!plan) throw new Error('Plan not found');

        const expiry = new Date();
        expiry.setHours(expiry.getHours() + plan.duration);

        await this.usersService.updateUser(payment.userId, {
          isActive: true,
          sessionExpiry: expiry,
        });
        await this.mikrotikService.activateUser(payment.userId, plan.duration);
      }

      return response.data;
    } catch (error: any) {
      console.error('Fapshi status check error:', error.message);
      throw error;
    }
  }

  async handleWebhookNotification(data: any) {
    try {
      console.log('Webhook received:', data);
      
      // Validate transId format
      if (!data?.transId || typeof data.transId !== 'string') {
        console.error('Invalid transId in webhook:', data);
        throw new Error('Invalid transId');
      }
      if (!/^[a-zA-Z0-9]{8,10}$/.test(data.transId)) {
        console.error('Invalid transaction id format:', data.transId);
        throw new Error('Invalid transaction id format');
      }

      // Get the transaction status from Fapshi API to verify source
      console.log('Fetching payment status from Fapshi for transId:', data.transId);
      const statusResponse = await axios.get(
        `${this.configService.get('FAPSHI_BASE_URL')}/payment-status/${data.transId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            apiuser: this.configService.get('FAPSHI_APIUSER'),
            apikey: this.configService.get('FAPSHI_APIKEY'),
          },
          timeout: 10000,
        },
      );

      console.log('Fapshi status response:', statusResponse.data);

      const payment = await this.paymentModel.findOne({
        fapshiTransactionId: data.transId,
      });
      if (!payment) {
        console.warn('Payment not found for transId:', data.transId);
        return { success: false, message: 'Payment not found' };
      }

      console.log('Found payment record:', payment);
      console.log('Payment status from Fapshi:', statusResponse.data.status);

      // Update payment status (normalize to enum: lowercase for initial states)
      const statusValue = statusResponse.data.status;
      payment.status = statusValue && ['created', 'pending'].includes(statusValue.toLowerCase())
        ? statusValue.toLowerCase()
        : statusValue;
      payment.fapshiResponse = statusResponse.data;
      await payment.save();
      console.log('Updated payment status to:', statusValue);

      // Handle different statuses
      switch (statusResponse.data.status) {
        case 'SUCCESSFUL':
        case 'SUCCESS':
          console.log('Activating user access for successful payment...');
          await this.activateUserAccess(payment);
          console.log('Payment successful:', data.transId);
          break;
        case 'FAILED':
          console.log('Recording failed payment:', data.transId);
          await this.recordPaymentTransaction(payment, 'failed');
          break;
        case 'PENDING':
          console.log('Recording pending payment:', data.transId);
          await this.recordPaymentTransaction(payment, 'pending');
          break;
        case 'EXPIRED':
          console.log('Recording expired payment:', data.transId);
          await this.recordPaymentTransaction(payment, 'expired');
          break;
        default:
          console.log('Recording unknown payment status:', statusResponse.data.status);
          await this.recordPaymentTransaction(payment, statusResponse.data.status.toLowerCase());
          break;
      }

      return { success: true, status: statusResponse.data.status };
    } catch (error: any) {
      console.error('Webhook notification error:', error.message);
      return { success: false, error: error.message };
    }
  }

  private async activateUserAccess(payment: PaymentDocument) {
    try {
      const plan = await this.plansService.findById(payment.planId);
      if (!plan) throw new Error('Plan not found');

      const expiry = new Date();
      expiry.setHours(expiry.getHours() + plan.duration);

      // Add purchased bundle to user record
      await this.usersService.addPurchasedBundle(payment.userId, {
        plan: payment.planId,
        planName: plan.name,
        purchasedAt: new Date(),
        amount: payment.amount,
        duration: plan.duration,
        status: 'active'
      });

      await this.usersService.updateUser(payment.userId, {
        isActive: true,
        sessionExpiry: expiry,
      });
      await this.mikrotikService.activateUser(payment.userId, plan.duration);

      console.log('User activated:', payment.userId);
    } catch (error: any) {
      console.error('Error activating user access:', error.message);
      throw error;
    }
  }

  private async recordPaymentTransaction(payment: PaymentDocument, status: string) {
    try {
      const plan = await this.plansService.findById(payment.planId);
      if (!plan) {
        console.error('Plan not found for payment recording:', payment.planId);
        return;
      }

      // Add transaction to user record for all statuses
      await this.usersService.addPurchasedBundle(payment.userId, {
        plan: payment.planId,
        planName: plan.name,
        purchasedAt: new Date(),
        amount: payment.amount,
        duration: plan.duration,
        status: status // 'active', 'failed', 'pending', 'expired'
      });

      console.log(`Payment transaction recorded with status: ${status}`);
    } catch (error: any) {
      console.error('Error recording payment transaction:', error.message);
    }
  }

  async getUserPurchases(userId: string) {
    try {
      const payments = await this.paymentModel.find({ userId }).sort({ createdAt: -1 }).exec();
      
      // Transform payments to include user's purchased bundles for status
      const user = await this.usersService.findById(userId);
      const purchasedBundles = user?.purchasedBundles || [];
      
      return payments.map(payment => {
        const bundleInfo = purchasedBundles.find(bundle => bundle.plan === payment.planId);
        return {
          id: payment._id,
          userId: payment.userId,
          bundleId: payment.planId,
          amount: payment.amount,
          status: bundleInfo?.status || payment.status,
          paymentMethod: 'mobile_money',
          transactionId: payment.fapshiTransactionId,
          createdAt: payment.createdAt,
          expiresAt: user?.sessionExpiry,
          serviceFee: payment.amount * 0.04,
          totalAmount: payment.amount * 1.04,
          feePercentage: 4
        };
      });
    } catch (error) {
      throw error;
    }
  }
}
