import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { MikrotikService } from '../mikrotik/mikrotik.service';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mikrotikService: MikrotikService,
  ) {}

  /**
   * Run every minute to check for expired sessions
   * This ensures users are disabled when their sessions expire
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleSessionCleanup() {
    try {
      const startTime = Date.now();
      this.logger.log(`⏰ Starting session cleanup process...`);

      const now = new Date();

      // Find users who are active but their session has expired
      this.logger.log(`  1️⃣ Querying database for expired sessions`);
      const expiredUsers = await this.userModel
        .find({
          isActive: true,
          sessionExpiry: { $lt: now },
        })
        .exec();

      if (expiredUsers.length === 0) {
        const elapsed = Date.now() - startTime;
        this.logger.log(`✅ No expired sessions found (${elapsed}ms)`);
        return;
      }

      this.logger.log(`  ✅ Found ${expiredUsers.length} expired user(s) to disable`);
      this.logger.log(`  2️⃣ Processing disabled users...`);

      for (const user of expiredUsers) {
        await this.disableExpiredUser(user);
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`✅ Session cleanup complete - disabled ${expiredUsers.length} user(s) in ${elapsed}ms`);
    } catch (error: any) {
      this.logger.error(`❌ Error during session cleanup: ${error.message}`);
    }
  }

  /**
   * Disable a single expired user
   */
  private async disableExpiredUser(user: UserDocument) {
    try {
      this.logger.log(`  ⏱️ Disabling expired session for: ${user.username} (expired: ${user.sessionExpiry})`);

      // 1. Unbind MAC address using FAILOVER (try both Home and School routers)
      if (user.macAddress) {
        try {
          this.logger.log(`    1️⃣ Removing MAC binding (failover): ${user.macAddress}`);
          await this.mikrotikService.unbindMacOnAvailableRouters(user.macAddress);
          this.logger.log(`    ✅ MAC address removed from bypass list(s): ${user.macAddress}`);
        } catch (macError: any) {
          this.logger.warn(
            `    ⚠️ Failed to unbind MAC ${user.macAddress}: ${macError.message} (will continue...)`,
          );
          // Continue even if MAC unbinding fails
        }
      }

      // 2. Disable user on MikroTik using FAILOVER (try both routers)
      try {
        this.logger.log(`    2️⃣ Disabling user on available MikroTik routers (failover)`);
        await this.mikrotikService.disableUser(user.username);
        this.logger.log(`    ✅ User disabled on MikroTik: ${user.username}`);
      } catch (mikrotikError: any) {
        this.logger.warn(
          `    ⚠️ Failed to disable ${user.username} on MikroTik: ${mikrotikError.message} (will continue...)`,
        );
        // Continue with database update even if MikroTik fails
      }

      // 3. Update user status in database
      this.logger.log(`    3️⃣ Updating user status in MongoDB`);
      await this.userModel.findByIdAndUpdate(user._id, {
        isActive: false,
        sessionExpiry: null,
        macAddress: null,
      });

      this.logger.log(`  ✅ User deactivated: ${user.username}`);
    } catch (error: any) {
      this.logger.error(
        `  ❌ Error deactivating user ${user.username}: ${error.message}`,
      );
    }
  }

  /**
   * Manual cleanup method for testing or immediate cleanup
   */
  async manualCleanup() {
    this.logger.log(`🔧 Running manual session cleanup...`);
    await this.handleSessionCleanup();
  }
}
