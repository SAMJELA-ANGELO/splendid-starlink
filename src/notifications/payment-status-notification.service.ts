import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { PaymentNotificationsService } from './payment-notifications.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class PaymentStatusNotificationService {
  private readonly logger = new Logger(PaymentStatusNotificationService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private paymentNotificationsService: PaymentNotificationsService,
    private plansService: PlansService,
  ) {}

  /**
   * Run every minute to check for payment status changes
   * Sends notifications when:
   * - Payment is SUCCESSFUL
   * - Payment is FAILED
   * - Payment is pending (initial state)
   */
  @Cron('*/1 * * * *') // Every minute
  async handlePaymentNotifications() {
    try {
      const startTime = Date.now();
      this.logger.log(`💳 Starting payment notification check...`);

      const now = new Date();
      const notificationsCounted = {
        initiated: 0,
        successful: 0,
        failed: 0,
      };

      // Find all payments that need notifications
      const paymentsNeedingNotification = await this.paymentModel
        .find({
          $or: [
            {
              // Payment just initiated (created status, no notification sent)
              status: 'created',
              notificationInitiatedSent: null,
            },
            {
              // Payment became successful
              status: 'SUCCESSFUL',
              notificationSuccessSent: null,
            },
            {
              // Payment failed
              status: 'FAILED',
              notificationFailedSent: null,
            },
          ],
        })
        .exec();

      if (paymentsNeedingNotification.length === 0) {
        const elapsed = Date.now() - startTime;
        this.logger.log(`✅ No pending payment notifications (${elapsed}ms)`);
        return;
      }

      this.logger.log(
        `  ✅ Found ${paymentsNeedingNotification.length} payment(s) needing notifications`,
      );

      // Process each payment
      for (const payment of paymentsNeedingNotification) {
        const user = await this.userModel.findById(payment.userId).exec();
        if (!user) {
          this.logger.warn(
            `  ⚠️ User not found for payment: ${payment.fapshiTransactionId}`,
          );
          continue;
        }

        // Get plan details
        const plan = await this.plansService.findById(payment.planId);

        switch (payment.status) {
          case 'created':
            // Payment just initiated
            this.logger.log(
              `  📧 Initiated notification for: ${user.username}`,
            );
            await this.paymentNotificationsService.sendPaymentInitiatedNotification(
              payment.userId,
              payment,
              payment.amount,
              payment.phone || 'Unknown phone',
            );
            await this.paymentModel.findByIdAndUpdate(payment._id, {
              notificationInitiatedSent: now,
            });
            notificationsCounted.initiated++;
            break;

          case 'SUCCESSFUL':
            // Payment succeeded - activate user
            this.logger.log(`  ✅ Success notification for: ${user.username}`);
            await this.paymentNotificationsService.sendPaymentSuccessNotification(
              payment.userId,
              payment,
              payment.amount,
              plan?.name || 'Bundle',
              plan?.duration || 0,
            );
            await this.paymentModel.findByIdAndUpdate(payment._id, {
              notificationSuccessSent: now,
            });
            notificationsCounted.successful++;
            break;

          case 'FAILED':
            // Payment failed
            this.logger.log(`  ❌ Failed notification for: ${user.username}`);
            const failureReason =
              payment.fapshiResponse?.message || 'Payment was declined';
            await this.paymentNotificationsService.sendPaymentFailedNotification(
              payment.userId,
              payment,
              payment.amount,
              failureReason,
            );
            await this.paymentModel.findByIdAndUpdate(payment._id, {
              notificationFailedSent: now,
            });
            notificationsCounted.failed++;
            break;
        }
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(
        `✅ Payment notification check complete (${elapsed}ms) - ` +
          `initiated: ${notificationsCounted.initiated}, ` +
          `successful: ${notificationsCounted.successful}, ` +
          `failed: ${notificationsCounted.failed}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error during payment notification check: ${error.message}`,
      );
    }
  }

  /**
   * Reset notification flags for testing/manual purposes
   */
  async resetNotificationFlags(paymentId: string) {
    try {
      this.logger.log(
        `🔄 Resetting payment notification flags for: ${paymentId}`,
      );
      await this.paymentModel.findByIdAndUpdate(paymentId, {
        notificationInitiatedSent: null,
        notificationSuccessSent: null,
        notificationFailedSent: null,
      });
      this.logger.log(`✅ Payment notification flags reset for: ${paymentId}`);
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to reset payment notification flags: ${error.message}`,
      );
      throw error;
    }
  }
}
