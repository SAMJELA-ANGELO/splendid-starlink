import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

@Injectable()
export class MikrotikService implements OnModuleInit {
  private logger = new Logger('MikrotikService');
  private proxyUrl: string = '';
  private httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
  private httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 50 });
  private axiosInstance = axios.create({
    timeout: 120000,
    httpAgent: this.httpAgent,
    httpsAgent: this.httpsAgent,
  });

  constructor(private configService: ConfigService) {}

  private isTestModeEnabled() {
    const testMode =
      this.configService.get('MIKROTIK_TEST_MODE') ??
      process.env.MIKROTIK_TEST_MODE;
    return String(testMode).toLowerCase() === 'true';
  }

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
    this.logger.log(
      `MikroTik service configured with proxy URL: ${this.proxyUrl}`,
    );
  }

  async createUser(username: string, password: string) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/users`;
    this.logger.log(`🔌 Creating MikroTik user: ${username}`);
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await this.axiosInstance.post(url, { username, password });
      this.logger.log(`  ✅ MikroTik user created successfully: ${username}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to create MikroTik user ${username}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async updateUserPassword(username: string, newPassword: string) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/users/password`;
    this.logger.log(`🔑 Updating password for MikroTik user: ${username}`);
    try {
      this.logger.log(`  1️⃣ Sending PUT request to: ${url}`);
      const resp = await this.axiosInstance.put(url, { username, newPassword });
      this.logger.log(`  ✅ Password updated for MikroTik user: ${username}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to update password for MikroTik user ${username}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async activateUser(username: string, durationHours: number) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/activate`;
    this.logger.log(
      `⏱️ Activating MikroTik user: ${username} (${durationHours}h)`,
    );
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await this.axiosInstance.post(url, { username, durationHours });
      this.logger.log(
        `  ✅ User activated: ${username} for ${durationHours} hours`,
      );
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
      const resp = await this.axiosInstance.delete(url, { data: { username } });
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
    this.logger.log(
      `🔒 Disabling MikroTik user: ${username} (keeping account)`,
    );
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await this.axiosInstance.post(url, { username });
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
      const resp = await this.axiosInstance.delete(url, { data: { username } });
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
      const resp = await this.axiosInstance.get(url);
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
      const resp = await this.axiosInstance.get(url);
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
      const resp = await this.axiosInstance.get(url);
      this.logger.log(`✅ User details retrieved: ${username}`);
      return resp.data.user || resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to get user details for ${username}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async userExists(username: string): Promise<boolean> {
    if (this.isTestModeEnabled()) {
      this.logger.warn(`🚧 MikroTik test mode enabled - mocking user existence check for ${username} (returning false)`);
      return false; // In test mode, assume user doesn't exist so creation will be attempted
    }

    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/users/${encodeURIComponent(
      username,
    )}`;
    this.logger.log(`🔍 Checking if MikroTik user exists: ${username}`);
    try {
      this.logger.log(`  1️⃣ Sending GET request to: ${url}`);
      const resp = await this.axiosInstance.get(url);
      const userExists = resp.data && resp.data.user;
      this.logger.log(`✅ User ${username} ${userExists ? 'exists' : 'does not exist'} on MikroTik`);
      return !!userExists;
    } catch (err: any) {
      // If user is not found (404), return false
      if (err.response && err.response.status === 404) {
        this.logger.log(`ℹ️ User ${username} does not exist on MikroTik (404 response)`);
        return false;
      }
      this.logger.error(
        `❌ Failed to check if user ${username} exists: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async getActiveUsers() {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/active-users`;
    this.logger.log(`🟢 Getting active MikroTik users`);
    try {
      this.logger.log(`  1️⃣ Sending GET request to: ${url}`);
      const resp = await this.axiosInstance.get(url);
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

  async bindMacToBypass(macAddress: string, durationHours: number = 0) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/bind-mac`;
    this.logger.log(
      `📌 Binding MAC address to bypass list: ${macAddress} (${durationHours}h)`,
    );
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await this.axiosInstance.post(url, { macAddress, durationHours });
      this.logger.log(`✅ MAC address bound to bypass: ${macAddress}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to bind MAC ${macAddress}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async unbindMac(macAddress: string) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/unbind-mac`;
    this.logger.log(`🔓 Removing MAC address from bypass list: ${macAddress}`);
    try {
      this.logger.log(`  1️⃣ Sending DELETE request to: ${url}`);
      const resp = await this.axiosInstance.delete(url, { params: { macAddress } });
      this.logger.log(`✅ MAC address removed from bypass: ${macAddress}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to unbind MAC ${macAddress}: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async activateOnAvailableRouter(
    username: string,
    durationHours: number,
    macAddress?: string,
  ) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/activate-failover`;
    this.logger.log(
      `🔄 Activating user on available router (failover): ${username} (${durationHours}h)${
        macAddress ? ` with MAC ${macAddress}` : ''
      }`,
    );
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await this.axiosInstance.post(url, {
        username,
        durationHours,
        macAddress,
      });
      this.logger.log(`✅ User activated on router: ${resp.data.activeRouter}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to activate user on available router: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async createHotspotUserOnly(username: string, durationHours: number) {
    if (this.isTestModeEnabled()) {
      this.logger.warn(`🚧 MikroTik test mode enabled - mocking hotspot user creation for ${username}`);
      // Simulate a successful response
      const mockResponse = {
        success: true,
        activeRouter: 'test-router-1',
        message: `Test mode: Hotspot user ${username} created successfully`,
        user: {
          username,
          durationHours,
          created: new Date().toISOString(),
        },
      };
      this.logger.log(`✅ Mock hotspot user created: ${username} (${durationHours}h)`);
      return mockResponse;
    }

    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/create-hotspot-user`;
    this.logger.log(
      `🎁 Creating hotspot user (gift - no MAC binding): ${username} (${durationHours}h)`,
    );
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await this.axiosInstance.post(url, { username, durationHours });
      this.logger.log(
        `✅ Hotspot user created on router: ${resp.data.activeRouter}`,
      );
      this.logger.log(
        `  ℹ️ User will log in manually; MAC will be captured on first login`,
      );
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to create hotspot user: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async bindMacOnAvailableRouter(
    macAddress: string,
    durationHours: number = 0,
  ) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/bind-mac-failover`;
    this.logger.log(
      `🔄 Binding MAC on available router (failover): ${macAddress} (${durationHours}h)`,
    );
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await this.axiosInstance.post(url, { macAddress, durationHours });
      this.logger.log(`✅ MAC bound on router: ${resp.data.activeRouter}`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to bind MAC on available router: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async unbindMacOnAvailableRouters(macAddress: string) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/unbind-mac-failover`;
    this.logger.log(
      `🔄 Removing MAC from available routers (failover): ${macAddress}`,
    );
    try {
      this.logger.log(`  1️⃣ Sending DELETE request to: ${url}`);
      const resp = await this.axiosInstance.delete(url, { params: { macAddress } });
      this.logger.log(`✅ MAC unbind completed on all available routers`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to unbind MAC on available routers: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }

  async silentLogin(
    username: string,
    password: string,
    macAddress: string,
    ipAddress: string,
    durationHours: number,
  ) {
    const url = `${this.proxyUrl.replace(/\/$/, '')}/api/mikrotik/silent-login`;
    this.logger.log(
      `🔐 Performing silent login for user: ${username} (MAC: ${macAddress}, IP: ${ipAddress}, ${durationHours}h)`,
    );
    try {
      this.logger.log(`  1️⃣ Sending POST request to: ${url}`);
      const resp = await this.axiosInstance.post(url, {
        username,
        password,
        macAddress,
        ipAddress,
        durationHours,
      });
      this.logger.log(
        `✅ Silent login successful on router: ${resp.data.activeRouter}`,
      );
      this.logger.log(`  ℹ️ User is now actively connected to the hotspot`);
      return resp.data;
    } catch (err: any) {
      this.logger.error(
        `❌ Silent login failed: ${err?.response?.data?.error || err.message}`,
      );
      throw err;
    }
  }
}
