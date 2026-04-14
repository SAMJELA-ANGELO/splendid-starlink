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
        const deactivateResult = await this.deactivateExpiredUser(user);
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
   * Deactivate a single expired user
   */
  private async deactivateExpiredUser(user: UserDocument) {
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

      // 2. Deactivate user on MikroTik using FAILOVER (try both routers)
      try {
        this.logger.log(
          `    2️⃣ Deactivating user on available MikroTik routers (failover)`,
        );
        await this.mikrotikService.deactivateUser(user.username);
        this.logger.log(`    ✅ User deactivated on MikroTik: ${user.username}`);
      } catch (mikrotikError: any) {
        this.logger.warn(
          `    ⚠️ Failed to deactivate ${user.username} on MikroTik: ${mikrotikError.message} (will continue...)`,
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

  /**
   * Manual cleanup method for unactivated users
   */
  async manualUnactivatedCleanup() {
    this.logger.log(`🧹 Running manual unactivated user cleanup...`);
    return this.handleUnactivatedUserCleanup();
  }

  /**
   * Run every 5 minutes to check for unactivated users older than 10 minutes
   * This ensures unactivated users are removed from MikroTik to free up resources
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleUnactivatedUserCleanup() {
    const startTime = Date.now();
    const result = {
      checkedAt: new Date(startTime).toISOString(),
      unactivatedCount: 0,
      deletedCount: 0,
      deletedUsers: [] as string[],
      failedUsers: [] as { username: string; reason: string }[],
      elapsedMs: 0,
    };

    this.logger.log(
      `🧹 Starting unactivated user cleanup process at ${result.checkedAt}`,
    );

    try {
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

      // Find users who are not active, created more than 20 minutes ago, and exist on MikroTik
      this.logger.log(`  1️⃣ Querying database for unactivated users older than 20 minutes`);
      const unactivatedUsers = await this.userModel
        .find({
          isActive: false,
          createdAt: { $lt: twentyMinutesAgo },
          mikrotikCreated: true,
        })
        .exec();

      result.unactivatedCount = unactivatedUsers.length;

      if (unactivatedUsers.length === 0) {
        result.elapsedMs = Date.now() - startTime;
        this.logger.log(`✅ No unactivated users to clean up (${result.elapsedMs}ms)`);
        return result;
      }

      this.logger.log(
        `  ✅ Found ${unactivatedUsers.length} unactivated user(s) to delete: ${unactivatedUsers
          .map((u) => u.username)
          .join(', ')}`,
      );
      this.logger.log(`  2️⃣ Processing unactivated users...`);

      for (const user of unactivatedUsers) {
        const deleteResult = await this.deleteUnactivatedUser(user);
        if (deleteResult.success) {
          result.deletedCount += 1;
          result.deletedUsers.push(user.username);
        } else {
          result.failedUsers.push({
            username: user.username,
            reason: deleteResult.reason || 'unknown error',
          });
        }
      }

      result.elapsedMs = Date.now() - startTime;
      this.logger.log(
        `✅ Unactivated user cleanup complete - processed ${result.unactivatedCount} user(s), deleted ${result.deletedCount}, failed ${result.failedUsers.length} in ${result.elapsedMs}ms`,
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
      this.logger.error(`❌ Error during unactivated user cleanup: ${error.message}`);
      result.failedUsers.push({ username: 'cleanup-run', reason: error.message });
      return result;
    }
  }

  /**
   * Deactivate a single unactivated user from MikroTik
   */
  private async deleteUnactivatedUser(user: UserDocument) {
    try {
      this.logger.log(
        `  🗑️ Deactivating unactivated user: ${user.username} (created: ${user.createdAt})`,
      );

      // 1. Deactivate user on MikroTik
      try {
        this.logger.log(`    1️⃣ Deactivating user on MikroTik: ${user.username}`);
        await this.mikrotikService.deactivateUser(user.username);
        this.logger.log(`    ✅ User deactivated on MikroTik: ${user.username}`);
      } catch (mikrotikError: any) {
        this.logger.warn(
          `    ⚠️ Failed to deactivate ${user.username} on MikroTik: ${mikrotikError.message} (will continue...)`,
        );
        // Continue with database update even if MikroTik fails
      }

      // 2. Update user status in database (mark as not created on MikroTik)
      this.logger.log(`    2️⃣ Updating user status in MongoDB`);
      await this.userModel.findByIdAndUpdate(user._id, {
        mikrotikCreated: false,
      });

      this.logger.log(`  ✅ Unactivated user deactivated: ${user.username}`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(
        `  ❌ Error deactivating unactivated user ${user.username}: ${error.message}`,
      );
      return { success: false, reason: error.message };
    }
  }
}
