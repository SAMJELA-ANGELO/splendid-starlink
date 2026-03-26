import { Injectable, Logger } from '@nestjs/common';
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
  private logger = new Logger('PaymentsService');
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
    this.logger.log(`💶 Initiating payment for user ${userId}, plan ${planId}`);
    try {
      this.logger.log(`  1️⃣ Fetching plan: ${planId}`);
      const plan = await this.plansService.findById(planId);
      if (!plan) throw new Error('Plan not found');
      this.logger.log(`  ✅ Plan found: ${plan.name} (${plan.price} XAF, ${plan.duration}h)`);

      // Validation
      if (!phone) throw new Error('Phone number is required for direct payment');
      if (!Number.isInteger(plan.price)) {
        throw new Error('Amount must be an integer');
      }
      if (plan.price < 100) {
        throw new Error('Amount cannot be less than 100 XAF');
      }
      this.logger.log(`  ✅ Validation passed`);

      // Build request payload for directPay
      this.logger.log(`  2️⃣ Building Fapshi payment request for ${phone}`);
      const paymentData: any = {
        amount: plan.price + plan.price * 0.04, // Add 4% fee
        phone: phone,
        userId: userId,
      };

      if (email) paymentData.email = email;
      if (externalId) paymentData.externalId = externalId;
      if (name) paymentData.name = name;

      // Call Fapshi API directPay endpoint (sends payment to mobile)
      this.logger.log(`  3️⃣ Calling Fapshi direct-pay API`);
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
      this.logger.log(`  ✅ Fapshi response received: TransID ${fapshiResponse.data.transId}`);

      // Create and save payment record
      this.logger.log(`  4️⃣ Saving payment record to MongoDB`);
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
      this.logger.log(`✅ Payment initiated successfully: ${fapshiResponse.data.transId}`);

      return {
        paymentId: payment._id,
        transId: fapshiResponse.data.transId,
        message: 'Payment request sent to your mobile phone. Please complete payment on your device.',
      };
    } catch (error: any) {
      this.logger.error(`❌ Payment initiation failed for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  async checkPaymentStatus(transactionId: string) {
    this.logger.log(`🔍 Checking payment status for transaction: ${transactionId}`);
    try {
      this.logger.log(`  1️⃣ Querying Fapshi API for status`);
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
      this.logger.log(`  ✅ Status received from Fapshi: ${response.data.status}`);

      this.logger.log(`  2️⃣ Looking up payment record in MongoDB`);
      const payment = await this.paymentModel.findOne({
        fapshiTransactionId: transactionId,
      });
      if (!payment) {
        this.logger.warn(`  ⚠️ Payment not found in database`);
        return response.data;
      }
      this.logger.log(`  ✅ Payment found in database`);

      // Update payment status (normalize to enum: lowercase for initial states)
      this.logger.log(`  3️⃣ Updating payment status in MongoDB`);
      const statusValue = response.data.status;
      payment.status = statusValue && ['created', 'pending'].includes(statusValue.toLowerCase())
        ? statusValue.toLowerCase()
        : statusValue;
      payment.fapshiResponse = response.data;
      await payment.save();
      this.logger.log(`  ✅ Payment status updated: ${payment.status}`);

      // Activate user if payment succeeded
      if (response.data.status === 'SUCCESSFUL') {
        this.logger.log(`  4️⃣ Payment successful - activating user access`);
        await this.activateUserAccess(payment);
      }

      this.logger.log(`✅ Payment status check complete: ${transactionId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Payment status check failed for ${transactionId}: ${error.message}`);
      throw error;
    }
  }

  async handleWebhookNotification(data: any) {
    this.logger.log(`🔔 Webhook notification received: ${data.transId}`);
    try {
      // Validate transId format
      if (!data?.transId || typeof data.transId !== 'string') {
        throw new Error('Invalid transId');
      }
      if (!/^[a-zA-Z0-9]{8,10}$/.test(data.transId)) {
        throw new Error('Invalid transaction id format');
      }
      this.logger.log(`  ✅ TransId format validated: ${data.transId}`);

      // Get the transaction status from Fapshi API to verify source
      this.logger.log(`  1️⃣ Verifying transaction with Fapshi API`);
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
      this.logger.log(`  ✅ Fapshi verification complete: ${statusResponse.data.status}`);

      this.logger.log(`  2️⃣ Looking up payment in database`);
      const payment = await this.paymentModel.findOne({
        fapshiTransactionId: data.transId,
      });
      if (!payment) {
        this.logger.warn(`  ⚠️ Payment not found for transId: ${data.transId}`);
        return { success: false, message: 'Payment not found' };
      }
      this.logger.log(`  ✅ Payment found: User ${payment.userId}`);

      // Update payment status (normalize to enum: lowercase for initial states)
      this.logger.log(`  3️⃣ Updating payment status`);
      const statusValue = statusResponse.data.status;
      payment.status = statusValue && ['created', 'pending'].includes(statusValue.toLowerCase())
        ? statusValue.toLowerCase()
        : statusValue;
      payment.fapshiResponse = statusResponse.data;
      await payment.save();
      this.logger.log(`  ✅ Payment status updated: ${payment.status}`);

      // Handle different statuses
      this.logger.log(`  4️⃣ Processing payment result`);
      switch (statusResponse.data.status) {
        case 'SUCCESSFUL':
          this.logger.log(`  ✅ Payment SUCCESSFUL - activating user access`);
          await this.activateUserAccess(payment);
          break;
        case 'FAILED':
          this.logger.warn(`  ❌ Payment FAILED: ${data.transId}`);
          break;
        case 'EXPIRED':
          this.logger.warn(`  ⏱️ Payment EXPIRED: ${data.transId}`);
          break;
        default:
          this.logger.warn(`  ⚠️ Unknown payment status: ${statusResponse.data.status}`);
      }

      this.logger.log(`✅ Webhook notification processed successfully: ${data.transId}`);
      return { success: true, status: statusResponse.data.status };
    } catch (error: any) {
      this.logger.error(`❌ Webhook notification error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async activateUserAccess(payment: PaymentDocument) {
    this.logger.log(`🚀 Activating user access for payment: ${payment._id}`);
    try {
      this.logger.log(`  1️⃣ Fetching plan details (ID: ${payment.planId})`);
      const plan = await this.plansService.findById(payment.planId);
      if (!plan) throw new Error('Plan not found');
      this.logger.log(`  ✅ Plan found: ${plan.name} (${plan.duration}h duration)`);

      this.logger.log(`  2️⃣ Fetching user details (ID: ${payment.userId})`);
      const user = await this.usersService.findById(payment.userId);
      if (!user) throw new Error('User not found');
      this.logger.log(`  ✅ User found: ${user.username}`);

      // Get user's actual username
      const username = user.username;

      this.logger.log(`  3️⃣ Calculating session expiry (${plan.duration} hours from now)`);
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + plan.duration);
      this.logger.log(`  ✅ Session will expire on: ${expiry.toISOString()}`);

      // Update user: set isActive and sessionExpiry
      this.logger.log(`  4️⃣ Updating user status in MongoDB`);
      await this.usersService.updateUser(payment.userId, {
        isActive: true,
        sessionExpiry: expiry,
      });
      this.logger.log(`  ✅ User marked as active in MongoDB`);

      // Activate user on MikroTik (user was created at signup)
      // Just enable access for the specified duration
      this.logger.log(`  5️⃣ Activating user on MikroTik hotspot (${username})`);
      await this.mikrotikService.activateUser(username, plan.duration);
      this.logger.log(`  ✅ User activated on MikroTik`);

      this.logger.log(`✅ User activation complete: ${username}`);
    } catch (error: any) {
      this.logger.error(`❌ Error activating user access: ${error.message}`);
      throw error;
    }
  }
}
