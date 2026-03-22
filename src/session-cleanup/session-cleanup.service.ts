import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';
import { MikrotikService } from '../mikrotik/mikrotik.service';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    private usersService: UsersService,
    private mikrotikService: MikrotikService,
  ) {}

  /**
   * Run every minute to check for expired sessions
   * This ensures users are deactivated promptly when their sessions expire
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleSessionCleanup() {
    try {
      this.logger.log('Starting session cleanup process...');
      
      const expiredUsers = await this.findExpiredUsers();
      
      if (expiredUsers.length === 0) {
        this.logger.log('No expired sessions found');
        return;
      }

      this.logger.log(`Found ${expiredUsers.length} expired users to deactivate`);

      for (const user of expiredUsers) {
        await this.deactivateExpiredUser(user);
      }

      this.logger.log(`Successfully deactivated ${expiredUsers.length} expired users`);
    } catch (error) {
      this.logger.error('Error during session cleanup:', error);
    }
  }

  /**
   * Find users with expired sessions
   */
  private async findExpiredUsers() {
    const now = new Date();
    
    // Find users who are active but their session has expired
    const expiredUsers = await this.usersService.findActiveUsersWithExpiredSessions(now);
    
    return expiredUsers;
  }

  /**
   * Deactivate a single expired user
   */
  private async deactivateExpiredUser(user: any) {
    try {
      this.logger.log(`Deactivating expired user: ${user.username}`);

      // 1. Deactivate from Mikrotik router
      try {
        await this.mikrotikService.deactivateUser(user.username);
        this.logger.log(`Successfully removed ${user.username} from Mikrotik hotspot`);
      } catch (mikrotikError) {
        this.logger.warn(`Failed to remove ${user.username} from Mikrotik: ${mikrotikError.message}`);
        // Continue with database update even if Mikrotik fails
      }

      // 2. Update user status in database
      await this.usersService.updateUser(user._id.toString(), {
        isActive: false,
        sessionExpiry: undefined,
      });

      // 3. Update purchased bundle status to 'expired'
      await this.usersService.updateExpiredBundle(user._id.toString());

      this.logger.log(`Successfully deactivated user ${user.username}`);
    } catch (error) {
      this.logger.error(`Failed to deactivate user ${user.username}:`, error);
    }
  }

  /**
   * Manual cleanup method for testing or immediate cleanup
   */
  async manualCleanup() {
    this.logger.log('Running manual session cleanup...');
    await this.handleSessionCleanup();
  }
}
