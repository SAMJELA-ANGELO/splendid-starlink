import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { UsersService } from '../users/users.service';
import { PlansService } from '../plans/plans.service';
import { MikrotikService } from '../mikrotik/mikrotik.service';
import { ActivitiesService } from '../activities/activities.service';
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
    private activitiesService: ActivitiesService,
    private configService: ConfigService,
  ) {}

  async initiatePayment(
    userId: string,
    planId: string,
    email?: string,
    phone?: string,
    externalId?: string,
    name?: string,
    macAddress?: string,
    routerIdentity?: string,
    isGift?: boolean,
    recipientUsername?: string,
    userIp?: string,
    password?: string,
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
        macAddress,
        routerIdentity,
        userIp,
        password,
        isGift: isGift || false,
        recipientUsername: recipientUsername || null,
        status: (fapshiResponse.data.status || 'created').toLowerCase(),
        fapshiTransactionId: fapshiResponse.data.transId,
        fapshiResponse: fapshiResponse.data,
      });
      await payment.save();
      
      if (macAddress) this.logger.log(`  📌 MAC address saved: ${macAddress}`);
      if (userIp) this.logger.log(`  🌐 User IP saved: ${userIp}`);
      if (routerIdentity) this.logger.log(`  🛰️ Router identity saved: ${routerIdentity}`);
      if (password) this.logger.log(`  🔐 Password saved for silent login`);
      if (isGift && recipientUsername) {
        this.logger.log(`  🎁 Gift payment for recipient: ${recipientUsername}`);
      }
      
      this.logger.log(`✅ Payment initiated successfully: ${fapshiResponse.data.transId}`);

      // Start background polling for webhook fallback
      this.pollFapshiStatus(payment.fapshiTransactionId)
        .then((res) => {
          if (res && res.status) {
            this.logger.log(`📡 Polling complete for ${payment.fapshiTransactionId} -> ${res.status}`);
          } else {
            this.logger.warn(`⌛ Polling complete for ${payment.fapshiTransactionId} with no terminal status`);
          }
        })
        .catch((err) => {
          this.logger.error(`❌ Polling error for ${payment.fapshiTransactionId}: ${err.message}`);
        });

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
        const activationResult = await this.activateUserAccess(payment);
        this.logger.log(`✅ Payment status check complete: ${transactionId}`);
        return {
          ...response.data,
          activation: activationResult,
          message: activationResult?.message || 'Payment completed and user activated'
        };
      }

      this.logger.log(`✅ Payment status check complete: ${transactionId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Payment status check failed for ${transactionId}: ${error.message}`);
      throw error;
    }
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async pollFapshiStatus(transactionId: string, intervalMs = 2000, timeoutMs = 180000) {
    this.logger.log(`🔁 Starting polling for Fapshi status fallback: ${transactionId}`);
    const maxAttempts = Math.ceil(timeoutMs / intervalMs);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.log(`  ⏱️ Poll attempt ${attempt}/${maxAttempts} for ${transactionId}`);
      try {
        const result = await this.checkPaymentStatus(transactionId);
        const status = result?.status?.toString?.().toUpperCase?.();

        if (status === 'SUCCESSFUL' || status === 'FAILED' || status === 'EXPIRED') {
          this.logger.log(`  ✅ Terminal status reached for ${transactionId}: ${status}`);
          return { status, result };
        }

        this.logger.log(`  ⏳ Current status for ${transactionId}: ${status || 'unknown'}`);
      } catch (error: any) {
        this.logger.warn(`  ⚠️ Poll attempt ${attempt} failed for ${transactionId}: ${error.message}`);
      }

      if (attempt < maxAttempts) {
        await this.sleep(intervalMs);
      }
    }

    this.logger.warn(`⌛ Polling timeout reached for ${transactionId} after ${timeoutMs / 1000}s`);
    return null;
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
          const activationResult = await this.activateUserAccess(payment);
          return { 
            success: true, 
            status: statusResponse.data.status,
            activation: activationResult,
            message: activationResult?.message || 'Payment completed and user activated'
          };
        case 'FAILED':
          this.logger.warn(`  ❌ Payment FAILED: ${data.transId}`);
          return { success: false, status: 'FAILED', message: 'Payment was declined' };
        case 'EXPIRED':
          this.logger.warn(`  ⏱️ Payment EXPIRED: ${data.transId}`);
          return { success: false, status: 'EXPIRED', message: 'Payment request has expired' };
        default:
          this.logger.warn(`  ⚠️ Unknown payment status: ${statusResponse.data.status}`);
          return { success: false, status: statusResponse.data.status, message: 'Unknown payment status' };
      }
    } catch (error: any) {
      this.logger.error(`❌ Webhook notification error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async activateUserAccess(payment: PaymentDocument) {
    this.logger.log(`🚀 Activating user access for payment: ${payment._id}`);
    this.logger.log(`   📋 Payment details: planId=${payment.planId}, userId=${payment.userId}, status=${payment.status}`);
    this.logger.log(`   📌 Device info: macAddress=${payment.macAddress}, routerIdentity=${payment.routerIdentity}`);
    this.logger.log(`   🔐 Silent login info: userIp=${payment.userIp}, hasPassword=${!!payment.password}`);
    
    try {
      this.logger.log(`  1️⃣ Fetching plan details (ID: ${payment.planId})`);
      const plan = await this.plansService.findById(payment.planId);
      if (!plan) throw new Error('Plan not found');
      this.logger.log(`  ✅ Plan found: ${plan.name} (${plan.duration}h duration)`);

      const isGift = payment.isGift || false;
      let username: string;
      let targetUserId: string;

      if (isGift && payment.recipientUsername) {
        // Gift flow: activate recipient's username
        username = payment.recipientUsername;
        targetUserId = payment.userId; // Still log against payer for audit, but activate recipient
        this.logger.log(`  🎁 GIFT FLOW: Activating for recipient: ${username}`);
      } else {
        // Self-purchase flow: activate payer's username
        this.logger.log(`  2️⃣ Fetching user details (ID: ${payment.userId})`);
        const user = await this.usersService.findById(payment.userId);
        if (!user) throw new Error('User not found');
        this.logger.log(`  ✅ User found: ${user.username}`);
        username = user.username;
        targetUserId = payment.userId;
      }

      this.logger.log(`  3️⃣ Calculating session expiry (${plan.duration} hours from now)`);
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + plan.duration);
      this.logger.log(`  ✅ Session will expire on: ${expiry.toISOString()}`);

      // For self-purchase: Update payer's user record with MAC binding
      // For gift: Skip MAC binding (recipient's device not known yet)
      if (!isGift) {
        this.logger.log(`  4️⃣ Updating payer's user status in MongoDB`);
        const userUpdateData: any = {
          isActive: true,
          sessionExpiry: expiry,
        };

        if (payment.macAddress) {
          userUpdateData.macAddress = payment.macAddress;
          this.logger.log(`  📌 MAC address found in payment: ${payment.macAddress}`);
        }
        
        if (payment.userIp) {
          userUpdateData.ipAddress = payment.userIp;
          this.logger.log(`  🌐 IP address found in payment: ${payment.userIp}`);
        }
        
        if (payment.routerIdentity) {
          userUpdateData.routerIdentity = payment.routerIdentity;
          this.logger.log(`  🛰️ Router identity found: ${payment.routerIdentity}`);
        }

        await this.usersService.updateUser(targetUserId, userUpdateData);
        this.logger.log(`  ✅ Payer marked as active in MongoDB with device info`);
      } else {
        this.logger.log(`  4️⃣ Gift flow: Skipping payer's MongoDB update (recipient will log in manually)`);
      }

      // Activate on MikroTik - FIRST: Create hotspot user so device can connect normally
      this.logger.log(`  5️⃣ Creating hotspot user on MikroTik router`);
      try {
        this.logger.log(`  📌 Creating hotspot user account: ${username}`);
        const createUserResult = await this.mikrotikService.createHotspotUserOnly(
          username,
          plan.duration,
        );
        this.logger.log(`  ✅ Hotspot user created on router: ${createUserResult.activeRouter}`);
        (payment as any).activeRouter = createUserResult.activeRouter;

        // Check if we can attempt silent login after device connects
        this.logger.log(`  📊 CHECKING SILENT LOGIN CAPABILITIES:`);
        this.logger.log(`     - isGift: ${isGift}`);
        this.logger.log(`     - payment.macAddress: ${payment.macAddress}`);
        this.logger.log(`     - payment.userIp: ${payment.userIp}`);
        this.logger.log(`     - payment.password: ${payment.password ? '(present)' : '(MISSING)'}`);
        
        const canAttemptSilentLogin = !isGift && payment.macAddress && payment.userIp && payment.password;
        if (canAttemptSilentLogin) {
          this.logger.log(`     → ✅ SILENT LOGIN AVAILABLE - Will attempt after device connects to WiFi`);
          this.logger.log(`     📌 Device must connect to WiFi first to appear in /ip/hotspot/host`);
        } else {
          this.logger.log(`     → ℹ️ STANDARD LOGIN ONLY - Device will authenticate via portal`);
        }
      } catch (activateError: any) {
        this.logger.error(`  ❌ MikroTik user creation failed: ${activateError.message}`);
        throw new Error(`Failed to create user on any router: ${activateError.message}`);
      }

      // Save activeRouter field for audit trail
      if ((payment as any).activeRouter) {
        payment.activeRouter = (payment as any).activeRouter;
        await payment.save();
      }

      // Log activity for successful payment
      const plan_ref = await this.plansService.findById(payment.planId);
      await this.activitiesService.logActivity(
        payment.userId,
        'payment_processed',
        'payment',
        `${isGift ? `Gift: ` : ''}Payment of ${payment.amount} CFA processed successfully for ${plan_ref?.name || 'Plan'} (${plan_ref?.duration}h)`,
        'success',
        {
          planName: plan_ref?.name,
          planId: payment.planId,
          amount: payment.amount,
          duration: plan_ref?.duration,
          transactionId: payment.fapshiTransactionId,
          isGift,
          recipientUsername: payment.recipientUsername || undefined,
        },
        undefined,
        {
          routerIdentity: payment.activeRouter,
          sessionId: undefined,
        },
      );

      this.logger.log(`✅ User activation complete: ${username}`);

      // Return activation data for silent login on frontend
      const activationResult = {
        success: true,
        username: username,
        sessionExpiry: expiry.toISOString(),
        readyForSilentLogin: true, // Enable silent login after payment
        message: 'User activated - ready for silent login'
      };
      
      this.logger.log(`   📦 Returning activation result: ${JSON.stringify(activationResult)}`);
      return activationResult;
    } catch (error: any) {
      this.logger.error(`❌ Error activating user access: ${error.message}`);
      
      // Log failed payment
      const plan_ref = await this.plansService.findById(payment.planId);
      await this.activitiesService.logActivity(
        payment.userId,
        'payment_failed',
        'payment',
        `Payment of ${payment.amount} CFA activation failed for ${plan_ref?.name || 'Plan'}: ${error.message}`,
        'failed',
        {
          planName: plan_ref?.name,
          amount: payment.amount,
          transactionId: payment.fapshiTransactionId,
          error: error.message,
        },
      );
      
      // Return error result instead of throwing
      return {
        success: false,
        error: error.message,
        readyForSilentLogin: false,
        message: `Activation failed: ${error.message}`
      };
    }
  }

  async reconnectUserIfNeeded(userId: string): Promise<{ reconnected: boolean; username?: string; remainingTime?: number; remainingHours?: number; reason?: string }> {
    this.logger.log(`🔄 Checking if user needs WiFi reconnection: ${userId}`);
    try {
      this.logger.log(`  1️⃣ Fetching user details (ID: ${userId})`);
      const user = await this.usersService.findById(userId);
      if (!user) {
        this.logger.warn(`  ⚠️ User not found: ${userId}`);
        return { reconnected: false, reason: 'User not found' };
      }
      this.logger.log(`  ✅ User found: ${user.username}`);

      // Check if user has an active session
      const isSessionActive = user.isActive && user.sessionExpiry && new Date() < user.sessionExpiry;
      
      if (!isSessionActive) {
        this.logger.log(`  ℹ️ User has no active session`);
        return { reconnected: false, reason: 'No active session' };
      }

      this.logger.log(`  2️⃣ User has active session - calculating remaining time`);
      const now = new Date();
      const remainingMs = user.sessionExpiry.getTime() - now.getTime();
      const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
      this.logger.log(`  ✅ Remaining session time: ${remainingHours} hours`);

      // Reactivate on MikroTik - move user from Hosts to Active
      this.logger.log(`  3️⃣ Reactivating user on MikroTik router (Hosts → Active)`);
      try {
        // For returning users with MAC & IP: Attempt silent login to move from Hosts to Active
        // Otherwise: Just ensure hotspot user exists
        if (user.macAddress && user.ipAddress) {
          this.logger.log(`  📌 Attempting silent login - moving user from Hosts to Active`);
          this.logger.log(`     MAC: ${user.macAddress}, IP: ${user.ipAddress}`);
          
          try {
            // Try to perform silent login to move user from Hosts to Active
            const silentLoginResult = await this.mikrotikService.silentLogin(
              user.username,
              user.password || '', // Use password if available
              user.macAddress,
              user.ipAddress,
              remainingHours,
            );
            this.logger.log(`  ✅ Silent login successful - user moved to Active tab on router: ${silentLoginResult.activeRouter}`);
            return { 
              reconnected: true, 
              username: user.username,
              remainingTime: remainingMs,
              remainingHours: remainingHours,
            };
          } catch (silentLoginError: any) {
            // Silent login failed - fallback to just ensuring user exists in hotspot
            this.logger.log(`  ⚠️ Silent login failed: ${silentLoginError.message}`);
            this.logger.log(`  📌 Falling back to basic hotspot user verification`);
            const createUserResult = await this.mikrotikService.createHotspotUserOnly(
              user.username,
              remainingHours,
            );
            this.logger.log(`  ✅ User verified on hotspot Hosts tab on router: ${createUserResult.activeRouter}`);
            this.logger.log(`  ℹ️ User is ready for normal login or silent login once device connects`);
          }
        } else {
          this.logger.log(`  📌 Basic reconnection - ensuring hotspot user exists: ${user.username}`);
          const createUserResult = await this.mikrotikService.createHotspotUserOnly(
            user.username,
            remainingHours,
          );
          this.logger.log(`  ✅ Hotspot user verified on router: ${createUserResult.activeRouter}`);
          this.logger.log(`  ℹ️ User account exists on MikroTik (Hosts tab)`);
        }

      return { 
        reconnected: true, 
        username: user.username,
        remainingTime: remainingMs,
        remainingHours: remainingHours,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error reconnecting user: ${error.message}`);
      // Log error but don't throw - user can still proceed even if reconnection fails
      return { reconnected: false, reason: `Connection error: ${error.message}` };
    }
  } catch (error: any) {
    this.logger.error(`❌ Unexpected error in reconnectUserIfNeeded: ${error.message}`);
    return { reconnected: false, reason: `Unexpected error: ${error.message}` };
  }
}

async getUserPayments(userId: string) {
    this.logger.log(`📋 Fetching payment history for user: ${userId}`);
    try {
      const payments = await this.paymentModel.find({ userId }).sort({ createdAt: -1 }).exec();
      this.logger.log(`✅ Retrieved ${payments.length} payments for user: ${userId}`);
      return payments;
    } catch (error: any) {
      this.logger.error(`❌ Error fetching payment history for user ${userId}: ${error.message}`);
      throw error;
    }
  }
}
