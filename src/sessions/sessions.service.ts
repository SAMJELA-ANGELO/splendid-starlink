import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private usersService: UsersService,
  ) {}

  async getCurrentSession(userId: string): Promise<Session | null> {
    this.logger.log(`📊 Getting current session for user: ${userId}`);
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        this.logger.warn(`⚠️ User not found: ${userId}`);
        return null;
      }

      // Check if user has active session
      const isSessionActive = user.isActive && user.sessionExpiry && new Date() < user.sessionExpiry;
      const now = new Date();
      const sessionExpiry = user.sessionExpiry || now;
      const remainingTime = isSessionActive ? Math.max(0, sessionExpiry.getTime() - now.getTime()) : 0;

      const session = {
        id: userId,
        userId: userId,
        startTime: sessionExpiry,
        endTime: undefined,
        dataUsed: 0,
        isActive: isSessionActive,
        remainingTime: remainingTime,
      };

      this.logger.log(`✅ Session retrieved for ${user.username}: Active=${isSessionActive}, Remaining=${remainingTime}ms`);
      return session;
    } catch (error: any) {
      this.logger.error(`❌ Error getting current session: ${error.message}`);
      return null;
    }
  }

  async getSessionStatus(userId: string): Promise<{ isActive: boolean; remainingTime?: number }> {
    this.logger.log(`⏱️ Getting session status for user: ${userId}`);
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        this.logger.warn(`⚠️ User not found: ${userId}`);
        return { isActive: false };
      }

      const isSessionActive = user.isActive && user.sessionExpiry && new Date() < user.sessionExpiry;
      const remainingTime = isSessionActive ? 
        Math.max(0, user.sessionExpiry.getTime() - new Date().getTime()) : 0;

      const status = { isActive: isSessionActive, remainingTime };
      this.logger.log(`✅ Session status for ${user.username}: ${isSessionActive ? '🟢 Active' : '⛔ Inactive'} (${remainingTime}ms)`);
      return status;
    } catch (error: any) {
      this.logger.error(`❌ Error getting session status: ${error.message}`);
      return { isActive: false };
    }
  }
}
