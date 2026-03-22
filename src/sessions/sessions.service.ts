import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private usersService: UsersService,
  ) {}

  async getCurrentSession(userId: string): Promise<Session | null> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        return null;
      }

      // Check if user has active session
      const isSessionActive = user.isActive && user.sessionExpiry && new Date() < user.sessionExpiry;
      const now = new Date();
      const sessionExpiry = user.sessionExpiry || now;
      const remainingTime = isSessionActive ? Math.max(0, sessionExpiry.getTime() - now.getTime()) : 0;

      return {
        id: userId,
        userId: userId,
        startTime: sessionExpiry,
        endTime: undefined,
        dataUsed: 0,
        isActive: isSessionActive,
        remainingTime: remainingTime,
      };
    } catch (error) {
      return null;
    }
  }

  async getSessionStatus(userId: string): Promise<{ isActive: boolean; remainingTime?: number }> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        return { isActive: false };
      }

      const isSessionActive = user.isActive && user.sessionExpiry && new Date() < user.sessionExpiry;
      const remainingTime = isSessionActive ? 
        Math.max(0, user.sessionExpiry.getTime() - new Date().getTime()) : 0;

      return { isActive: isSessionActive, remainingTime };
    } catch (error) {
      return { isActive: false };
    }
  }
}
