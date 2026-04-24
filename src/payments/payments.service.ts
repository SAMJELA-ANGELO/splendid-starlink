import { randomBytes } from 'crypto';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { UsersService } from '../users/users.service';
import { PlansService } from '../plans/plans.service';
import { MikrotikService } from '../mikrotik/mikrotik.service';
import { ActivitiesService } from '../activities/activities.service';
import { BlacklistService } from '../blacklist/blacklist.service';
import { PaymentsGateway } from './payments.gateway';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  private logger = new Logger('PaymentsService');
  private httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
  private httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 50 });

  private getAxiosConfig(additional: Record<string, any> = {}) {
    return {
      timeout: 10000,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      ...additional,
    };
  }

  private isTestAutoPaymentEnabled() {
    const testMode =
      this.configService.get('PAYMENT_TEST_MODE') ??
      process.env.PAYMENT_TEST_MODE;
    return String(testMode).toLowerCase() === 'true';
  }

  private scheduleTestAutoSuccess(payment: PaymentDocument) {
    const transactionId = payment.fapshiTransactionId;
    this.logger.warn(`🚧 Test payment auto-success enabled for ${transactionId}`);

    setTimeout(async () => {
      try {
        const savedPayment = await this.paymentModel.findById(payment._id);
        if (!savedPayment) {
          this.logger.error(
            `❌ Auto-success test failed: payment record not found ${transactionId}`,
          );
          return;
        }

        savedPayment.status = 'SUCCESSFUL';
        savedPayment.fapshiResponse = {
          status: 'SUCCESSFUL',
          message: 'Auto-success test payment',
          transId: transactionId,
        };
        await savedPayment.save();

        this.paymentsGateway.emitPaymentStatus(transactionId, 'SUCCESSFUL', {
          message: 'Test payment auto-approved',
          planName: savedPayment.planName,
          amount: savedPayment.amount,
        });

        await this.activateUserAccess(savedPayment)
          .then((activationResult) => {
            if (activationResult?.success) {
              this.paymentsGateway.emitPaymentStatus(transactionId, 'ACTIVATED', {
                message: 'Activation completed successfully',
                activation: activationResult,
              });
            } else {
              this.paymentsGateway.emitPaymentStatus(transactionId, 'ACTIVATION_FAILED', {
                message: 'Activation failed after test payment success',
                error:
                  (activationResult as any)?.message ||
                  (activationResult as any)?.error ||
                  'Unknown activation failure',
              });
            }
          })
          .catch((activationError) => {
            this.logger.error(
              `❌ Auto-success activation error for ${transactionId}: ${activationError?.message || activationError}`,
            );
            this.paymentsGateway.emitPaymentStatus(transactionId, 'ACTIVATION_ERROR', {
              message: 'Activation encountered an error after test payment success',
              error: activationError?.message || activationError,
            });
          });
      } catch (error: any) {
        this.logger.error(
          `❌ Auto-success scheduling failed for ${transactionId}: ${error?.message || error}`,
        );
      }
    }, 3000);
  }

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private usersService: UsersService,
    private plansService: PlansService,
    private mikrotikService: MikrotikService,
    private activitiesService: ActivitiesService,
    private blacklistService: BlacklistService,
    private configService: ConfigService,
    private paymentsGateway: PaymentsGateway,
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
      this.logger.log(`  1️⃣ Loading initial payment data`);
      const planPromise = this.plansService.findById(planId);
      const userPromise = this.usersService.findById(userId);
      const macBlacklistPromise = macAddress
        ? this.blacklistService.isBlacklisted('MAC', macAddress)
        : Promise.resolve(false);
      const ipBlacklistPromise = userIp
        ? this.blacklistService.isBlacklisted('IP', userIp)
        : Promise.resolve(false);
      const phoneBlacklistPromise = phone
        ? this.blacklistService.isBlacklisted('PHONE', phone)
        : Promise.resolve(false);
      const phoneStrikePromise =
        macAddress && phone
          ? this.blacklistService.checkPhoneStrikeSystem(macAddress, phone)
          : Promise.resolve(false);

      const [plan, user] = await Promise.all([planPromise, userPromise]);

      if (!plan) throw new Error('Plan not found');
      if (!user) throw new Error('User not found');
      this.logger.log(`  ✅ User found: ${user.username}`);
      this.logger.log(
        `  ✅ Plan found: ${plan.name} (${plan.price} XAF, ${plan.duration}h)`,
      );

      // Wait for blacklist checks to complete
      const [
        isMacBlocked,
        isIpBlocked,
        isPhoneBlocked,
        isStrikeTriggered,
      ] = await Promise.all([
        macBlacklistPromise,
        ipBlacklistPromise,
        phoneBlacklistPromise,
        phoneStrikePromise,
      ]);

      if (isMacBlocked) {
        throw new Error('This device is temporarily blocked due to suspicious activity.');
      }
      if (isIpBlocked) {
        throw new Error('This IP address is temporarily blocked due to suspicious activity.');
      }
      if (isPhoneBlocked) {
        throw new Error('This phone number is temporarily blocked due to suspicious activity.');
      }

      if (isStrikeTriggered) {
        throw new Error('This device has been temporarily blocked due to multiple phone number usage.');
      }

      // Validation
      if (!phone)
        throw new Error('Phone number is required for direct payment');
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

      if (email) {
        // Sanitize email: trim whitespace and validate basic format
        const sanitizedEmail = email.trim();
        if (
          sanitizedEmail &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)
        ) {
          paymentData.email = sanitizedEmail;
        } else {
          this.logger.warn(
            `⚠️ Invalid email format: "${email}", skipping email in payment request`,
          );
        }
      }
      if (externalId) paymentData.externalId = externalId;
      if (name) paymentData.name = name;

      if (this.isTestAutoPaymentEnabled()) {
        const fakeTransId = `TEST-${Date.now()}-${randomBytes(4).toString('hex')}`;
        this.logger.warn(
          `🚧 Skipping Fapshi call in test mode and auto-succeeding payment ${fakeTransId}`,
        );

        // Create and save a test payment record that will auto-succeed shortly.
        const payment = new this.paymentModel({
          userId,
          planId,
          planName: plan.name,
          amount: plan.price,
          email,
          phone,
          externalId,
          macAddress,
          ipAddress: userIp,
          routerIdentity,
          password,
          isGift: isGift || false,
          recipientUsername: recipientUsername || null,
          status: 'created',
          fapshiTransactionId: fakeTransId,
          fapshiResponse: {
            status: 'created',
            message: 'Auto-success test payment created',
            testMode: true,
          },
        });
        await payment.save();

        void this.scheduleTestAutoSuccess(payment);

        return {
          paymentId: payment._id,
          transId: fakeTransId,
          message:
            'Test payment created. Transaction will auto-succeed in 3 seconds.',
        };
      }

      // Call Fapshi API directPay endpoint (sends payment to mobile)
      this.logger.log(`  3️⃣ Calling Fapshi direct-pay API`);
      const fapshiResponse = await axios.post(
        `${this.configService.get('FAPSHI_BASE_URL')}/direct-pay`,
        paymentData,
        this.getAxiosConfig({
          headers: {
            'Content-Type': 'application/json',
            apiuser: this.configService.get('FAPSHI_APIUSER'),
            apikey: this.configService.get('FAPSHI_APIKEY'),
          },
        }),
      );

      this.logger.log(
        `  ✅ Fapshi response received: TransID ${fapshiResponse.data.transId}`,
      );

      // Create and save payment record
      this.logger.log(`  4️⃣ Saving payment record to MongoDB`);
      const payment = new this.paymentModel({
        userId,
        planId,
        planName: plan.name,
        amount: plan.price,
        email,
        phone,
        externalId,
        macAddress,
        ipAddress: userIp,
        routerIdentity,
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
      if (routerIdentity)
        this.logger.log(`  🛰️ Router identity saved: ${routerIdentity}`);
      if (password) this.logger.log(`  🔐 Password saved for silent login`);
      if (isGift && recipientUsername) {
        this.logger.log(
          `  🎁 Gift payment for recipient: ${recipientUsername}`,
        );
      }

      this.logger.log(
        `✅ Payment initiated successfully: ${fapshiResponse.data.transId}`,
      );

      // Start background polling for webhook fallback
      this.pollFapshiStatus(payment.fapshiTransactionId)
        .then((res) => {
          if (res && res.status) {
            this.logger.log(
              `📡 Polling complete for ${payment.fapshiTransactionId} -> ${res.status}`,
            );
          } else {
            this.logger.warn(
              `⌛ Polling complete for ${payment.fapshiTransactionId} with no terminal status`,
            );
          }
        })
        .catch((err) => {
          this.logger.error(
            `❌ Polling error for ${payment.fapshiTransactionId}: ${err.message}`,
          );
        });

      return {
        paymentId: payment._id,
        transId: fapshiResponse.data.transId,
        message:
          'Payment request sent to your mobile phone. Please complete payment on your device.',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Payment initiation failed for user ${userId}: ${error.message}`,
      );

      // Convert Fapshi errors to user-friendly messages
      let userFriendlyMessage = 'Payment initiation failed. Please try again.';

      if (error.response) {
        // Fapshi returned an error response
        const fapshiError = error.response.data;
        this.logger.error(`❌ Fapshi error response:`, fapshiError);

        if (fapshiError.message) {
          const errorMsg = fapshiError.message.toLowerCase();

          if (errorMsg.includes('invalid phone') || errorMsg.includes('phone number')) {
            userFriendlyMessage = 'Invalid phone number. Please check the format and try again.';
          } else if (errorMsg.includes('insufficient balance') || errorMsg.includes('balance')) {
            userFriendlyMessage = 'Insufficient account balance. Please top up and try again.';
          } else if (errorMsg.includes('unauthorized') || errorMsg.includes('authentication')) {
            userFriendlyMessage = 'Payment service temporarily unavailable. Please try again later.';
          } else if (errorMsg.includes('timeout') || errorMsg.includes('network')) {
            userFriendlyMessage = 'Payment request timed out. Please check your connection and try again.';
          } else if (errorMsg.includes('amount') && errorMsg.includes('invalid')) {
            userFriendlyMessage = 'Invalid payment amount. Please select a valid plan.';
          } else {
            // Use Fapshi's message if it's user-friendly, otherwise use generic
            userFriendlyMessage = fapshiError.message.length < 100 ? fapshiError.message : userFriendlyMessage;
          }
        } else if (fapshiError.error) {
          // Some Fapshi errors have an 'error' field
          const errorMsg = fapshiError.error.toLowerCase();
          if (errorMsg.includes('phone')) {
            userFriendlyMessage = 'Invalid phone number format. Please use a valid Cameroon mobile number.';
          } else if (errorMsg.includes('amount')) {
            userFriendlyMessage = 'Invalid payment amount. Please select a different plan.';
          }
        }
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        userFriendlyMessage = 'Payment service is currently unavailable. Please try again in a few minutes.';
      } else if (error.code === 'ETIMEDOUT') {
        userFriendlyMessage = 'Payment request timed out. Please check your internet connection and try again.';
      }

      // Create a new error with user-friendly message
      const userError = new Error(userFriendlyMessage);
      userError.name = 'PaymentError';
      throw userError;
    }
  }

  async checkPaymentStatus(transactionId: string) {
    this.logger.log(
      `🔍 Checking payment status for transaction: ${transactionId}`,
    );
    try {
      this.logger.log(`  1️⃣ Querying Fapshi API for status`);
      const response = await axios.get(
        `${this.configService.get('FAPSHI_BASE_URL')}/payment-status/${transactionId}`,
        this.getAxiosConfig({
          headers: {
            'Content-Type': 'application/json',
            apiuser: this.configService.get('FAPSHI_APIUSER'),
            apikey: this.configService.get('FAPSHI_APIKEY'),
          },
        }),
      );
      this.logger.log(
        `  ✅ Status received from Fapshi: ${response.data.status}`,
      );

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
      payment.status =
        statusValue &&
        ['created', 'pending'].includes(statusValue.toLowerCase())
          ? statusValue.toLowerCase()
          : statusValue;
      payment.fapshiResponse = response.data;
      await payment.save();
      this.logger.log(`  ✅ Payment status updated: ${payment.status}`);

      // Activate user if payment succeeded
      if (response.data.status === 'SUCCESSFUL') {
        this.logger.log(`  4️⃣ Payment successful - scheduling background activation`);
        this.activateUserAccess(payment)
          .then((activationResult) => {
            if (activationResult?.success) {
              this.logger.log(
                `✅ Background activation completed for ${payment._id}: ${activationResult.message}`,
              );
            } else {
              const activationResultMessage =
                (activationResult as any)?.message ||
                (activationResult as any)?.error ||
                'Unknown activation failure';
              this.logger.error(
                `❌ Background activation failed for ${payment._id}: ${activationResultMessage}`,
              );
            }
          })
          .catch((activationError) => {
            this.logger.error(
              `❌ Background activation error for ${payment._id}: ${activationError?.message || activationError}`,
            );
          });

        this.logger.log(`✅ Payment status check complete: ${transactionId}`);
        return {
          ...response.data,
          activation: {
            inProgress: true,
            message: 'Activation started in the background',
          },
          isGift: payment.isGift,
          recipientUsername: payment.recipientUsername,
          message: 'Payment completed. User activation is in progress.',
        };
      }

      this.logger.log(`✅ Payment status check complete: ${transactionId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `❌ Payment status check failed for ${transactionId}: ${error.message}`,
      );

      // Convert Fapshi errors to user-friendly messages for status checks
      let userFriendlyMessage = 'Unable to check payment status. Please try again.';

      if (error.response) {
        const fapshiError = error.response.data;
        this.logger.error(`❌ Fapshi status check error:`, fapshiError);

        if (fapshiError.message) {
          const errorMsg = fapshiError.message.toLowerCase();

          if (errorMsg.includes('not found') || errorMsg.includes('transaction')) {
            userFriendlyMessage = 'Payment transaction not found. It may have expired.';
          } else if (errorMsg.includes('timeout') || errorMsg.includes('network')) {
            userFriendlyMessage = 'Payment status check timed out. Please check your connection.';
          } else {
            userFriendlyMessage = fapshiError.message.length < 100 ? fapshiError.message : userFriendlyMessage;
          }
        }
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        userFriendlyMessage = 'Payment service is currently unavailable. Please try again later.';
      } else if (error.code === 'ETIMEDOUT') {
        userFriendlyMessage = 'Payment status check timed out. Please try again.';
      }

      const userError = new Error(userFriendlyMessage);
      userError.name = 'PaymentStatusError';
      throw userError;
    }
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async pollFapshiStatus(
    transactionId: string,
    initialIntervalMs = 2000,
    timeoutMs = 180000,
  ) {
    this.logger.log(
      `🔁 Starting polling for Fapshi status fallback: ${transactionId}`,
    );
    const backoffIntervals = [initialIntervalMs, 5000, 10000, 30000];
    const startTime = Date.now();
    let attempt = 0;

    while (Date.now() - startTime < timeoutMs) {
      attempt += 1;
      this.logger.log(
        `  ⏱️ Poll attempt ${attempt} for ${transactionId}`,
      );
      try {
        const result = await this.checkPaymentStatus(transactionId);
        const status = result?.status?.toString?.().toUpperCase?.();

        if (
          status === 'SUCCESSFUL' ||
          status === 'FAILED' ||
          status === 'EXPIRED'
        ) {
          this.logger.log(
            `  ✅ Terminal status reached for ${transactionId}: ${status}`,
          );
          return { status, result };
        }

        this.logger.log(
          `  ⏳ Current status for ${transactionId}: ${status || 'unknown'}`,
        );
      } catch (error: any) {
        this.logger.warn(
          `  ⚠️ Poll attempt ${attempt} failed for ${transactionId}: ${error.message}`,
        );
      }

      const elapsed = Date.now() - startTime;
      const nextInterval = backoffIntervals[
        Math.min(attempt - 1, backoffIntervals.length - 1)
      ];
      if (elapsed + nextInterval >= timeoutMs) {
        break;
      }
      await this.sleep(nextInterval);
    }

    this.logger.warn(
      `⌛ Polling timeout reached for ${transactionId} after ${timeoutMs / 1000}s`,
    );
    return null;
  }

  private reconnectUserInBackground(user: any, remainingHours: number) {
    if (!user?.username) {
      this.logger.warn(
        `⚠️ Background reconnection skipped: missing username`,
      );
      return Promise.resolve();
    }

    this.logger.log(
      `  📌 Background router reactivation for ${user.username}`,
    );
    this.logger.log(
      `     MAC: ${user.macAddress || 'none'}, IP: ${user.ipAddress || 'none'}`,
    );

    return this.mikrotikService
      .activateOnAvailableRouter(user.username, remainingHours, user.macAddress)
      .then((result) => {
        this.logger.log(
          `  ✅ Background router activation succeeded: ${result?.activeRouter || 'unknown router'}`,
        );
      })
      .catch((error: any) => {
        this.logger.error(
          `❌ Background reconnection failed for ${user.username}: ${error?.message || error}`,
        );
      });
  }

  private logActivityInBackground(
    userId: string,
    eventType: string,
    category: string,
    message: string,
    status: string,
    metadata?: any,
    channel?: any,
    extra?: any,
  ) {
    const activityPromise = this.activitiesService.logActivity(
      userId,
      eventType,
      category,
      message,
      status,
      metadata,
      channel,
      extra,
    );

    if (activityPromise && typeof (activityPromise as any).catch === 'function') {
      void (activityPromise as any).catch((activityError: any) => {
        this.logger.error(
          `❌ Activity log failed for payment ${userId}: ${activityError?.message || activityError}`,
        );
      });
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
        this.getAxiosConfig({
          headers: {
            'Content-Type': 'application/json',
            apiuser: this.configService.get('FAPSHI_APIUSER'),
            apikey: this.configService.get('FAPSHI_APIKEY'),
          },
        }),
      );
      this.logger.log(
        `  ✅ Fapshi verification complete: ${statusResponse.data.status}`,
      );

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
      payment.status =
        statusValue &&
        ['created', 'pending'].includes(statusValue.toLowerCase())
          ? statusValue.toLowerCase()
          : statusValue;
      payment.fapshiResponse = statusResponse.data;
      await payment.save();
      this.logger.log(`  ✅ Payment status updated: ${payment.status}`);

      // Emit real-time status update via WebSocket
      this.paymentsGateway.emitPaymentStatus(data.transId, payment.status, {
        message: `Payment ${payment.status}`,
        planName: (payment as any).planName,
        amount: payment.amount,
      });

      // Handle different statuses
      this.logger.log(`  4️⃣ Processing payment result`);
      switch (statusResponse.data.status) {
        case 'SUCCESSFUL':
          this.logger.log(`  ✅ Payment SUCCESSFUL - scheduling background activation`);
          this.activateUserAccess(payment)
            .then((activationResult) => {
              if (activationResult?.success) {
                this.logger.log(
                  `✅ Background activation completed for ${payment._id}: ${activationResult.message}`,
                );
                // Emit activation success
                this.paymentsGateway.emitPaymentStatus(data.transId, 'ACTIVATED', {
                  message: 'User access activated successfully',
                  activation: activationResult,
                });
              } else {
                const activationResultMessage =
                  (activationResult as any)?.message ||
                  (activationResult as any)?.error ||
                  'Unknown activation failure';
                this.logger.error(
                  `❌ Background activation failed for ${payment._id}: ${activationResultMessage}`,
                );
                // Emit activation failure
                this.paymentsGateway.emitPaymentStatus(data.transId, 'ACTIVATION_FAILED', {
                  message: 'Payment successful but activation failed',
                  error: activationResultMessage,
                });
              }
            })
            .catch((activationError) => {
              this.logger.error(
                `❌ Background activation error for ${payment._id}: ${activationError?.message || activationError}`,
              );
              // Emit activation error
              this.paymentsGateway.emitPaymentStatus(data.transId, 'ACTIVATION_ERROR', {
                message: 'Payment successful but activation encountered an error',
                error: activationError?.message || activationError,
              });
            });

          return {
            success: true,
            status: 'ok',
            message: 'Payment accepted. Activation is processing in the background.',
          };
        case 'FAILED':
          this.logger.warn(`  ❌ Payment FAILED: ${data.transId}`);

          // Provide more specific failure reasons based on Fapshi response
          let failureMessage = 'Payment was declined';
          if (statusResponse.data.message) {
            const fapshiMsg = statusResponse.data.message.toLowerCase();
            if (fapshiMsg.includes('insufficient') || fapshiMsg.includes('balance')) {
              failureMessage = 'Payment failed: Insufficient account balance';
            } else if (fapshiMsg.includes('cancelled') || fapshiMsg.includes('declined')) {
              failureMessage = 'Payment was cancelled or declined';
            } else if (fapshiMsg.includes('timeout') || fapshiMsg.includes('expired')) {
              failureMessage = 'Payment timed out or expired';
            } else if (fapshiMsg.includes('invalid')) {
              failureMessage = 'Payment failed: Invalid transaction details';
            } else {
              // Use Fapshi's message if it's concise and user-friendly
              failureMessage = statusResponse.data.message.length < 100
                ? `Payment failed: ${statusResponse.data.message}`
                : failureMessage;
            }
          }

          // Emit failure status
          this.paymentsGateway.emitPaymentStatus(data.transId, 'FAILED', {
            message: failureMessage,
          });

          return {
            success: false,
            status: 'FAILED',
            message: failureMessage,
          };
        case 'EXPIRED':
          this.logger.warn(`  ⏱️ Payment EXPIRED: ${data.transId}`);
          // Emit expired status
          this.paymentsGateway.emitPaymentStatus(data.transId, 'EXPIRED', {
            message: 'Payment request has expired',
          });
          return {
            success: false,
            status: 'EXPIRED',
            message: 'Payment request has expired',
          };
        default:
          this.logger.warn(
            `  ⚠️ Unknown payment status: ${statusResponse.data.status}`,
          );
          return {
            success: false,
            status: statusResponse.data.status,
            message: 'Unknown payment status',
          };
      }
    } catch (error: any) {
      this.logger.error(`❌ Webhook notification error: ${error.message}`);

      // Convert webhook errors to user-friendly messages
      let errorMessage = 'Payment processing failed. Please contact support if the issue persists.';

      if (error.response) {
        const fapshiError = error.response.data;
        this.logger.error(`❌ Fapshi webhook error response:`, fapshiError);

        if (fapshiError.message) {
          const errorMsg = fapshiError.message.toLowerCase();

          if (errorMsg.includes('not found') || errorMsg.includes('transaction')) {
            errorMessage = 'Payment transaction not found. Please try initiating a new payment.';
          } else if (errorMsg.includes('timeout') || errorMsg.includes('network')) {
            errorMessage = 'Payment service temporarily unavailable. Your payment may still be processing.';
          } else {
            errorMessage = fapshiError.message.length < 100 ? fapshiError.message : errorMessage;
          }
        }
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = 'Payment service is currently unavailable. Please try again later.';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Payment processing timed out. Please check your payment status manually.';
      }

      return {
        success: false,
        error: errorMessage,
        technical: error.message // Keep technical details for logging
      };
    }
  }

  private async activateUserAccess(payment: PaymentDocument) {
    this.logger.log(`🚀 Activating user access for payment: ${payment._id}`);
    this.logger.log(
      `   📋 Payment details: planId=${payment.planId}, userId=${payment.userId}, status=${payment.status}`,
    );
    this.logger.log(
      `   📌 Device info: macAddress=${payment.macAddress}, routerIdentity=${payment.routerIdentity}`,
    );
    this.logger.log(
      `   🔐 Silent login info: userIp=${payment.userIp}, hasPassword=${!!payment.password}`,
    );

    try {
      this.logger.log(`  1️⃣ Fetching plan details (ID: ${payment.planId})`);
      const plan = await this.plansService.findById(payment.planId);
      if (!plan) throw new Error('Plan not found');
      this.logger.log(
        `  ✅ Plan found: ${plan.name} (${plan.duration}h duration)`,
      );

      const isGift = payment.isGift || false;
      let username: string;
      let targetUserId: string;
      let needsReactivation = false;

      if (isGift && payment.recipientUsername) {
        // Gift flow: activate recipient's username
        username = payment.recipientUsername;
        this.logger.log(
          `  🎁 GIFT FLOW: Activating for recipient: ${username}`,
        );

        // Check if recipient exists
        this.logger.log(`  2️⃣ Checking if recipient exists: ${username}`);
        let recipient = await this.usersService.findByUsername(username);

        if (!recipient) {
          // Create new recipient user
          this.logger.log(`  ➕ Recipient doesn't exist, creating new user: ${username}`);
          recipient = await this.usersService.create(
            username,
            payment.password || username, // Use provided password or default to username
            undefined, // macAddress - not known for gifts
            undefined, // ipAddress - not known for gifts
            undefined, // routerIdentity - not known for gifts
          );
          this.logger.log(`  ✅ New recipient user created: ${(recipient as any)._id}`);
          needsReactivation = false; // New user, not reactivation
        } else {
          this.logger.log(`  ✅ Recipient found: ${recipient.username} (${recipient.isActive ? 'Active' : 'Inactive'})`);
          needsReactivation = !recipient.isActive;
          if (needsReactivation) {
            this.logger.log(`  🔄 Recipient needs reactivation`);
          }
        }

        targetUserId = (recipient as any)._id; // Use recipient's ID for database updates
      } else {
        // Self-purchase flow: activate payer's username
        this.logger.log(`  2️⃣ Fetching user details (ID: ${payment.userId})`);
        const user = await this.usersService.findById(payment.userId);
        if (!user) throw new Error('User not found');
        this.logger.log(`  ✅ User found: ${user.username}`);
        username = user.username;
        targetUserId = payment.userId;

        // Check if user is deactivated and needs reactivation
        needsReactivation = !user.isActive;
      }

      this.logger.log(
        `  3️⃣ Calculating session expiry (${plan.duration} hours from now)`,
      );
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + plan.duration);
      this.logger.log(`  ✅ Session will expire on: ${expiry.toISOString()}`);

      // Update user record in MongoDB (recipient for gifts, payer for self-purchase)
      this.logger.log(`  4️⃣ Checking user activation status in MongoDB`);

      if (needsReactivation) {
        this.logger.log(
          `  🔄 USER NEEDS REACTIVATION: ${username} was deactivated, reactivating...`,
        );
      } else {
        this.logger.log(
          `  📝 User activation status: ${isGift ? 'New recipient or extending recipient session' : 'New user or extending active session'}`,
        );
      }

      const userUpdateData: any = {
        isActive: true,
        sessionExpiry: expiry,
      };

      // For gifts, we don't have device info since recipient logs in manually
      // For self-purchase, include device info for silent login
      if (!isGift) {
        if (payment.macAddress) {
          userUpdateData.macAddress = payment.macAddress;
          this.logger.log(
            `  📌 MAC address found in payment: ${payment.macAddress}`,
          );
        }

        if (payment.userIp) {
          userUpdateData.ipAddress = payment.userIp;
          this.logger.log(
            `  🌐 IP address found in payment: ${payment.userIp}`,
          );
        }

        if (payment.routerIdentity) {
          userUpdateData.routerIdentity = payment.routerIdentity;
          this.logger.log(
            `  🛰️ Router identity found: ${payment.routerIdentity}`,
          );
        }
      }

      await this.usersService.updateUser(targetUserId, userUpdateData);
      this.logger.log(
        `  ✅ ${isGift ? 'Recipient' : 'User'} ${needsReactivation ? 'reactivated' : 'activated'} in MongoDB${isGift ? '' : ' with device info'}`,
      );

      // Activate on MikroTik - FIRST: ensure the user account exists and the router state is provisioned.
      this.logger.log(
        `  5️⃣ Ensuring MikroTik user account exists and is provisioned: ${username}`,
      );

      const accountPassword = payment.password || username;
      this.logger.log(
        `  🔐 Using router password for ${username}: ${payment.password ? 'provided password' : 'fallback to username'}`,
      );

      const userExistsOnMikrotik = await this.mikrotikService.userExists(username);
      if (!userExistsOnMikrotik) {
        this.logger.log(
          `  ➕ User ${username} does not exist on MikroTik - creating account...`,
        );
        await this.mikrotikService.createUser(username, accountPassword);
        this.logger.log(`  ✅ MikroTik account created for ${username}`);
      } else {
        this.logger.log(`  ✅ MikroTik account already exists for ${username}`);
        this.logger.log(
          `  ℹ️ Skipping password update during payment activation; router account should already be provisioned with the correct credentials`,
        );
      }

      this.logger.log(
        `  6️⃣ Provisioning router state for ${username} (${plan.duration}h)`,
      );
      const routerProvisionResult = await this.mikrotikService.activateOnAvailableRouter(
        username,
        plan.duration,
        payment.macAddress,
      );
      this.logger.log(
        `  ✅ Router provisioning completed for ${username}: ${routerProvisionResult.activeRouter}`,
      );
      (payment as any).activeRouter = routerProvisionResult.activeRouter;

      // Save activeRouter field for audit trail
      if ((payment as any).activeRouter) {
        payment.activeRouter = (payment as any).activeRouter;
        await payment.save();
      }

      this.logger.log(
        `  ℹ️ Activation is now state-based. User can connect to WiFi when ready.`,
      );

      const activationResult = {
        success: true,
        username,
        password: accountPassword,
        sessionExpiry: expiry.toISOString(),
        activeRouter: routerProvisionResult.activeRouter,
        message: isGift
          ? `Gift activated for ${username}. Recipient can now log in manually.`
          : `User ${needsReactivation ? 'reactivated' : 'activated'} and ready for WiFi login.`,
        wasReactivation: needsReactivation,
        isGift: isGift,
      };

      const plan_ref = await this.plansService.findById(payment.planId);
      this.logActivityInBackground(
        payment.userId,
        'payment_processed',
        'payment',
        `${isGift ? `Gift: ` : ''}${needsReactivation ? 'Reactivation: ' : ''}Payment of ${payment.amount} CFA processed successfully for ${plan_ref?.name || 'Plan'} (${plan_ref?.duration}h)`,
        'success',
        {
          planName: plan_ref?.name,
          planId: payment.planId,
          amount: payment.amount,
          duration: plan_ref?.duration,
          transactionId: payment.fapshiTransactionId,
          isGift,
          recipientUsername: payment.recipientUsername || undefined,
          wasReactivation: needsReactivation,
        },
        undefined,
        {
          routerIdentity: payment.activeRouter,
          sessionId: undefined,
        },
      );

      this.logger.log(
        `✅ ${isGift ? 'Gift recipient' : 'User'} ${needsReactivation ? 'reactivation' : 'activation'} complete: ${username}`,
      );
      return activationResult;
    } catch (error: any) {
      this.logger.error(`❌ Error activating user access: ${error.message}`);

      // Log failed payment
      const plan_ref = await this.plansService.findById(payment.planId);
      this.logActivityInBackground(
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
        message: `Activation failed: ${error.message}`,
      };
    }
  }

  async reconnectUserIfNeeded(userId: string): Promise<{
    reconnected: boolean;
    username?: string;
    remainingTime?: number;
    remainingHours?: number;
    reason?: string;
  }> {
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
      const isSessionActive =
        user.isActive && user.sessionExpiry && new Date() < user.sessionExpiry;

      if (!isSessionActive) {
        this.logger.log(`  ℹ️ User has no active session`);
        return { reconnected: false, reason: 'No active session' };
      }

      this.logger.log(
        `  2️⃣ User has active session - calculating remaining time`,
      );
      const now = new Date();
      const remainingMs = user.sessionExpiry.getTime() - now.getTime();
      const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
      this.logger.log(`  ✅ Remaining session time: ${remainingHours} hours`);

      this.logger.log(
        `  3️⃣ Reactivating user on MikroTik router (Hosts → Active)`,
      );
      void this.reconnectUserInBackground(user, remainingHours);

      return {
        reconnected: true,
        username: user.username,
        remainingTime: remainingMs,
        remainingHours: remainingHours,
      };
    } catch (error: any) {
      this.logger.error(`❌ Unexpected error in reconnectUserIfNeeded: ${error.message}`);
      return {
        reconnected: false,
        reason: `Unexpected error: ${error.message}`,
      };
    }
  }

  async getUserPayments(userId: string) {
    this.logger.log(`📋 Fetching payment history for user: ${userId}`);
    try {
      const payments = await this.paymentModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .exec();
      this.logger.log(
        `✅ Retrieved ${payments.length} payments for user: ${userId}`,
      );
      return payments;
    } catch (error: any) {
      this.logger.error(
        `❌ Error fetching payment history for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }
}
