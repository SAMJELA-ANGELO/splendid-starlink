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
      // Validate transId format
      if (!data?.transId || typeof data.transId !== 'string') {
        throw new Error('Invalid transId');
      }
      if (!/^[a-zA-Z0-9]{8,10}$/.test(data.transId)) {
        throw new Error('Invalid transaction id format');
      }

      // Get the transaction status from Fapshi API to verify source
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

      const payment = await this.paymentModel.findOne({
        fapshiTransactionId: data.transId,
      });
      if (!payment) {
        console.warn('Payment not found for transId:', data.transId);
        return { success: false, message: 'Payment not found' };
      }

      // Update payment status (normalize to enum: lowercase for initial states)
      const statusValue = statusResponse.data.status;
      payment.status = statusValue && ['created', 'pending'].includes(statusValue.toLowerCase())
        ? statusValue.toLowerCase()
        : statusValue;
      payment.fapshiResponse = statusResponse.data;
      await payment.save();

      // Handle different statuses
      switch (statusResponse.data.status) {
        case 'SUCCESSFUL':
          await this.activateUserAccess(payment);
          console.log('Payment successful:', data.transId);
          break;
        case 'FAILED':
          console.log('Payment failed:', data.transId);
          break;
        case 'EXPIRED':
          console.log('Payment expired:', data.transId);
          break;
        default:
          console.log('Unknown payment status:', statusResponse.data.status);
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
}
