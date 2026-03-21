import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection } from 'mikrotik';

@Injectable()
export class MikrotikService implements OnModuleInit {
  private connection: Connection;
  private logger = new Logger('MikrotikService');

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      this.connection = new Connection({
        host: this.configService.get('MIKROTIK_HOST'),
        user: this.configService.get('MIKROTIK_USER'),
        password: this.configService.get('MIKROTIK_PASSWORD'),
        port: Number(this.configService.get('MIKROTIK_API_PORT') || 8728),
      });

      // Handle connection errors without crashing
      this.connection.on('error', (error: any) => {
        this.logger.warn(
          `MikroTik connection error: ${error.message}. Hotspot features temporarily unavailable.`,
        );
      });

      await this.connection.connect();
      this.logger.log('MikroTik router connected successfully');
    } catch (error: any) {
      this.logger.warn(
        `Failed to connect to MikroTik router: ${error.message}. Hotspot features will be unavailable.`,
      );
    }
  }

  async activateUser(username: string, durationHours: number) {
    if (!this.connection) {
      this.logger.warn(
        `Cannot activate user ${username}: MikroTik router not connected`,
      );
      throw new Error('MikroTik router not connected');
    }

    // Check if connection is ready
    try {
      await this.connection.connect();
      this.logger.log('MikroTik connection verified before activation');
    } catch (connectError) {
      this.logger.warn(`MikroTik connection failed: ${connectError.message}`);
      throw new Error('Failed to connect to MikroTik router');
    }

    const profile = `profile-${durationHours}h`;
    const uptimeLimit = `${durationHours}h`;

    try {
      this.logger.log(`Activating user ${username} with profile ${profile} for ${uptimeLimit}`);

      // Use the correct Mikrotik API method
      const result = await this.connection.write('/ip/hotspot/user/add', [
        `=name=${username}`,
        `=password=${username}`,
        `=profile=${profile}`,
        `=limit-uptime=${uptimeLimit}`,
      ]);

      this.logger.log(`Successfully activated user ${username}, result:`, result);
    } catch (err: any) {
      if (err.message && err.message.includes('already exists')) {
        this.logger.log(`User ${username} already exists, updating profile`);
        try {
          const updateResult = await this.connection.write('/ip/hotspot/user/set', [
            `=numbers=${username}`,
            `=password=${username}`,
            `=profile=${profile}`,
            `=limit-uptime=${uptimeLimit}`,
          ]);
          this.logger.log(`Successfully updated user ${username}, result:`, updateResult);
        } catch (updateErr) {
          this.logger.error(`Failed to update user ${username}: ${updateErr.message}`);
          throw updateErr;
        }
      } else {
        this.logger.error(`Failed to activate user ${username}: ${err.message}`);
        this.logger.error('Full error details:', err);
        throw err;
      }
    }
  }

  async deactivateUser(username: string) {
    if (!this.connection) {
      this.logger.warn(
        `Cannot deactivate user ${username}: MikroTik router not connected`,
      );
      throw new Error('MikroTik router not connected');
    }

    try {
      this.logger.log(`Deactivating user ${username}`);
      await this.connection.write('/ip/hotspot/user/remove', [
        '=numbers=' + username,
      ]);
      this.logger.log(`Successfully deactivated user ${username}`);
    } catch (err: any) {
      this.logger.error(`Failed to deactivate user ${username}: ${err.message}`);
      throw err;
    }
  }

  async testConnection() {
    if (!this.connection) {
      throw new Error('MikroTik router not connected');
    }

    try {
      const result = await this.connection.write('/system/identity/print');
      this.logger.log('MikroTik connection test successful');
      return { connected: true, identity: result };
    } catch (err: any) {
      this.logger.error(`MikroTik connection test failed: ${err.message}`);
      throw err;
    }
  }

  async listHotspotUsers() {
    if (!this.connection) {
      throw new Error('MikroTik router not connected');
    }

    try {
      const users = await this.connection.write('/ip/hotspot/user/print');
      this.logger.log(`Retrieved ${users.length} hotspot users`);
      return users;
    } catch (err: any) {
      this.logger.error(`Failed to list hotspot users: ${err.message}`);
      throw err;
    }
  }

  async getUserDetails(username: string) {
    if (!this.connection) {
      throw new Error('MikroTik router not connected');
    }

    try {
      const users = await this.connection.write('/ip/hotspot/user/print', [
        '?name=' + username,
      ]);

      if (users && users.length > 0) {
        this.logger.log(`Found user ${username} details`);
        return users[0];
      } else {
        this.logger.log(`User ${username} not found`);
        return null;
      }
    } catch (err: any) {
      this.logger.error(`Failed to get user details for ${username}: ${err.message}`);
      throw err;
    }
  }

  async getActiveUsers() {
    if (!this.connection) {
      throw new Error('MikroTik router not connected');
    }

    try {
      const activeUsers = await this.connection.write('/ip/hotspot/active/print');
      this.logger.log(`Retrieved ${activeUsers.length} active hotspot users`);
      return activeUsers;
    } catch (err: any) {
      this.logger.error(`Failed to get active users: ${err.message}`);
      throw err;
    }
  }
}
