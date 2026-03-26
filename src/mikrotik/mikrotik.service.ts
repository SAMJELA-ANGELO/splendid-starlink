import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MikrotikService implements OnModuleInit {
  private logger = new Logger('MikrotikService');
  private proxyUrl: string = '';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Use the .NET MikroTik service (Tik4Net) via HTTP proxy
    const urlFromConfig = this.configService.get<string>('MIKROTIK_PROXY_URL');
    if (!urlFromConfig) {
      this.logger.error(
        'MIKROTIK_PROXY_URL environment variable is not configured. MikroTik features will be unavailable.',
      );
      throw new Error(
        'MIKROTIK_PROXY_URL is required to communicate with MikroTik service',
      );
    }
    this.proxyUrl = urlFromConfig;
    this.logger.log(`MikroTik service configured with proxy URL: ${this.proxyUrl}`);
  }

  async createUser(username: string, password: string) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/users`;
    this.logger.log(`🔌 Creating MikroTik user: ${username}`);
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await axios.post(url, { username, password });
      this.logger.log(`  ✅ MikroTik user created successfully: ${username}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to create MikroTik user ${username}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async activateUser(username: string, durationHours: number) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/activate`;
    this.logger.log(`⏱️ Activating MikroTik user: ${username} (${durationHours}h)`);
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await axios.post(url, { username, durationHours });
      this.logger.log(`  ✅ User activated: ${username} for ${durationHours} hours`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to activate user ${username}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async deactivateUser(username: string) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/deactivate`;
    this.logger.warn(`⛔ DEPRECATED: Deactivating user ${username}`);
    try {
      this.logger.log(`  1️⃣ Sending DELETE request to: ${url}`);
      const resp = await axios.delete(url, { data: { username } });
      this.logger.log(`  ✅ User deactivated: ${username}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to deactivate user ${username}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async disableUser(username: string) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/disable`;
    this.logger.log(`🔒 Disabling MikroTik user: ${username} (keeping account)`);
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await axios.post(url, { username });
      this.logger.log(`  ✅ User disabled (account retained): ${username}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to disable user ${username}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async deleteUser(username: string) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/delete`;
    this.logger.log(`🗑️ Permanently deleting MikroTik user: ${username}`);
    try {
      this.logger.log(`  1️⃣ Sending DELETE request to: ${url}`);
      const resp = await axios.delete(url, { data: { username } });
      this.logger.log(`  ✅ User permanently deleted: ${username}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to delete user ${username}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async testConnection() {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/test-connection`;
    this.logger.log(`🌐 Testing MikroTik connection`);
    try {
      this.logger.log(`  1️⃣ Sending GET request to: ${url}`);
      const resp = await axios.get(url);
      this.logger.log(`✅ MikroTik connection test successful`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Connection test failed: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async listHotspotUsers() {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/users`;
    this.logger.log(`📋 Listing all MikroTik hotspot users`);
    try {
      this.logger.log(`  1️⃣ Sending GET request to: ${url}`);
      const resp = await axios.get(url);
      const userList = resp.data.users || resp.data;
      const count = Array.isArray(userList) ? userList.length : 0;
      this.logger.log(`✅ Retrieved ${count} hotspot users`);
      return userList;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to list hotspot users: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async getUserDetails(username: string) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/users/${encodeURIComponent(
      username,
    )}`;
    this.logger.log(`🔍 Getting details for MikroTik user: ${username}`);
    try {
      this.logger.log(`  1️⃣ Sending GET request to: ${url}`);
      const resp = await axios.get(url);
      this.logger.log(`✅ User details retrieved: ${username}`);
      return resp.data.user || resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to get user details for ${username}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async getActiveUsers() {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/active-users`;
    this.logger.log(`🟢 Getting active MikroTik users`);
    try {
      this.logger.log(`  1️⃣ Sending GET request to: ${url}`);
      const resp = await axios.get(url);
      const activeList = resp.data.activeUsers || resp.data;
      const count = Array.isArray(activeList) ? activeList.length : 0;
      this.logger.log(`✅ Retrieved ${count} active users`);
      return activeList;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to get active users: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }
}
