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
    const startTime = Date.now();
    const result = {
      checkedAt: new Date(startTime).toISOString(),
      expiredCount: 0,
      disabledCount: 0,
      disabledUsers: [] as string[],
      failedUsers: [] as { username: string; reason: string }[],
      elapsedMs: 0,
    };

    this.logger.log(
      `⏰ Starting session cleanup process at ${result.checkedAt}`,
    );

    try {
      const now = new Date();

      // Find users who are active but their session has expired
      this.logger.log(`  1️⃣ Querying database for expired sessions`);
      const expiredUsers = await this.userModel
        .find({
          isActive: true,
          sessionExpiry: { $lt: now },
        })
        .exec();

      result.expiredCount = expiredUsers.length;

      if (expiredUsers.length === 0) {
        result.elapsedMs = Date.now() - startTime;
        this.logger.log(`✅ No expired sessions found (${result.elapsedMs}ms)`);
        return result;
      }

      this.logger.log(
        `  ✅ Found ${expiredUsers.length} expired user(s) to disable: ${expiredUsers
          .map((u) => u.username)
          .join(', ')}`,
      );
      this.logger.log(`  2️⃣ Processing expired users...`);

      for (const user of expiredUsers) {
        const deactivateResult = await this.disableExpiredUser(user);
        if (deactivateResult.success) {
          result.disabledCount += 1;
          result.disabledUsers.push(user.username);
        } else {
          result.failedUsers.push({
            username: user.username,
            reason: deactivateResult.reason || 'unknown error',
          });
        }
      }

      result.elapsedMs = Date.now() - startTime;
      this.logger.log(
        `✅ Session cleanup complete - processed ${result.expiredCount} expired user(s), disabled ${result.disabledCount}, failed ${result.failedUsers.length} in ${result.elapsedMs}ms`,
      );
      if (result.failedUsers.length > 0) {
        this.logger.warn(
          `⚠️ Failed cleanup for: ${result.failedUsers
            .map((f) => `${f.username} (${f.reason})`)
            .join(', ')}`,
        );
      }

      return result;
    } catch (error: any) {
      result.elapsedMs = Date.now() - startTime;
      this.logger.error(`❌ Error during session cleanup: ${error.message}`);
      result.failedUsers.push({ username: 'cleanup-run', reason: error.message });
      return result;
    }
  }

  async getExpiredSessions() {
    const now = new Date();
    this.logger.log(`🔎 Checking current expired sessions at ${now.toISOString()}`);

    const expiredUsers = await this.userModel
      .find(
        {
          isActive: true,
          sessionExpiry: { $lt: now },
        },
        {
          username: 1,
          sessionExpiry: 1,
          macAddress: 1,
          routerIdentity: 1,
        },
      )
      .lean();

    const result = expiredUsers.map((user) => ({
      username: user.username,
      sessionExpiry: user.sessionExpiry,
      macAddress: user.macAddress || null,
      routerIdentity: user.routerIdentity || null,
    }));

    this.logger.log(
      `✅ Found ${result.length} expired session(s): ${result
        .map((u) => u.username)
        .join(', ') || 'none'}`,
    );
    return {
      checkedAt: now.toISOString(),
      expiredCount: result.length,
      expiredUsers: result,
    };
  }

  /**
   * Disable a single expired user
   */
  private async disableExpiredUser(user: UserDocument) {
    try {
      this.logger.log(
        `  ⏱️ Disabling expired session for: ${user.username} (expired: ${user.sessionExpiry})`,
      );

      // 1. Unbind MAC address using FAILOVER (try both Home and School routers)
      if (user.macAddress) {
        try {
          this.logger.log(
            `    1️⃣ Removing MAC binding (failover): ${user.macAddress}`,
          );
          await this.mikrotikService.unbindMacOnAvailableRouters(
            user.macAddress,
          );
          this.logger.log(
            `    ✅ MAC address removed from bypass list(s): ${user.macAddress}`,
          );
        } catch (macError: any) {
          this.logger.warn(
            `    ⚠️ Failed to unbind MAC ${user.macAddress}: ${macError.message} (will continue...)`,
          );
          // Continue even if MAC unbinding fails
        }
      }

      // 2. Disable user on MikroTik using FAILOVER (try both routers)
      try {
        this.logger.log(
          `    2️⃣ Disabling user on available MikroTik routers (failover)`,
        );
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
      return { success: true };
    } catch (error: any) {
      this.logger.error(
        `  ❌ Error deactivating user ${user.username}: ${error.message}`,
      );
      return { success: false, reason: error.message };
    }
  }

  /**
   * Manual cleanup method for testing or immediate cleanup
   */
  async manualCleanup() {
    this.logger.log(`🔧 Running manual session cleanup...`);
    return this.handleSessionCleanup();
  }
}
