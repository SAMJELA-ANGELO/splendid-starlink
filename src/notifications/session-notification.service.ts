import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { User, UserDocument } from '../schemas/user.schema';
import { NotificationsService } from './notifications.service';

@Injectable()
export class SessionNotificationService {
  private readonly logger = new Logger(SessionNotificationService.name);

  // Time thresholds in milliseconds
  private readonly THIRTY_MIN_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  private readonly TEN_MIN_THRESHOLD = 10 * 60 * 1000; // 10 minutes

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Run every 2 minutes to check for sessions expiring soon
   * Sends notifications at:
   * - 30 minutes before expiry
   * - 10 minutes before expiry
   * - When session has expired
   */
  @Cron('*/2 * * * *') // Every 2 minutes
  async handleSessionNotifications() {
    try {
      const startTime = Date.now();
      this.logger.log(`📲 Starting session notification check...`);

      const now = new Date();
      const usersCounted = { notified30min: 0, notified10min: 0, notified: 0 };

      // Find all active users with pending sessions
      const activeUsers = await this.userModel
        .find({
          isActive: true,
          sessionExpiry: { $ne: null },
        })
        .exec();

      if (activeUsers.length === 0) {
        const elapsed = Date.now() - startTime;
        this.logger.log(`✅ No active sessions to check (${elapsed}ms)`);
        return;
      }

      this.logger.log(
        `  ✅ Found ${activeUsers.length} active session(s) to check`,
      );

      // Check each active user's session
      for (const user of activeUsers) {
        const sessionExpiry = user.sessionExpiry.getTime();
        const timeRemaining = sessionExpiry - now.getTime();

        // 30-minute warning
        if (
          timeRemaining > 0 &&
          timeRemaining <= this.THIRTY_MIN_THRESHOLD &&
          !user.notification30minSent
        ) {
          this.logger.log(
            `  ⏰ 30-minute warning for: ${user.username}`,
          );
          await this.notificationsService.sendSessionWarning30min(
            user,
            timeRemaining,
          );
          await this.userModel.findByIdAndUpdate(user._id, {
            notification30minSent: now,
          });
          usersCounted.notified30min++;
        }

        // 10-minute warning
        if (
          timeRemaining > 0 &&
          timeRemaining <= this.TEN_MIN_THRESHOLD &&
          !user.notification10minSent
        ) {
          this.logger.log(
            `  ⏰ 10-minute warning for: ${user.username}`,
          );
          await this.notificationsService.sendSessionWarning10min(
            user,
            timeRemaining,
          );
          await this.userModel.findByIdAndUpdate(user._id, {
            notification10minSent: now,
          });
          usersCounted.notified10min++;
        }

        // Session expired notification
        if (timeRemaining <= 0 && !user.notificationExpiredSent) {
          this.logger.log(
            `  ⛔ Expired notification for: ${user.username}`,
          );
          await this.notificationsService.sendSessionExpiredNotification(user);
          await this.userModel.findByIdAndUpdate(user._id, {
            notificationExpiredSent: now,
          });
          usersCounted.notified++;
        }
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(
        `✅ Session notification check complete (${elapsed}ms) - ` +
          `30min: ${usersCounted.notified30min}, ` +
          `10min: ${usersCounted.notified10min}, ` +
          `expired: ${usersCounted.notified}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error during session notification check: ${error.message}`,
      );
    }
  }

  /**
   * Reset notification flags for testing/manual purposes
   */
  async resetNotificationFlags(userId: string) {
    try {
      this.logger.log(`🔄 Resetting notification flags for user: ${userId}`);
      await this.userModel.findByIdAndUpdate(userId, {
        notification30minSent: null,
        notification10minSent: null,
        notificationExpiredSent: null,
      });
      this.logger.log(`✅ Notification flags reset for user: ${userId}`);
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to reset notification flags: ${error.message}`,
      );
      throw error;
    }
  }
}
