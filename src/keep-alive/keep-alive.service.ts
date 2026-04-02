import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);
  private readonly API_URL = process.env.API_URL || 'http://localhost:3000/api';

  @Cron('*/2 * * * *') // Every 2 minutes
  async keepAlive() {
    try {
      const response = await axios.get(`${this.API_URL}/health/ping`, {
        timeout: 5000,
      });
      this.logger.debug(
        `✅ Keep-alive ping successful: ${response.data.message}`,
      );
    } catch (error) {
      this.logger.warn(`⚠️ Keep-alive ping failed: ${error.message}`);
      // Log but don't throw - we want the cron job to keep running even if one ping fails
    }
  }
}
