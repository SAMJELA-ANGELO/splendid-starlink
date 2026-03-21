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
      if (!user || !user.isActive) {
        return null;
      }

      // Check if user has active session
      if (user.sessionExpiry && new Date() < user.sessionExpiry) {
        return {
          id: userId,
          userId: userId,
          startTime: user.sessionExpiry,
          endTime: undefined,
          dataUsed: 0,
          isActive: true,
          remainingTime: Math.max(0, user.sessionExpiry.getTime() - new Date().getTime()),
        };
      }

      return {
        id: userId,
        userId: userId,
        startTime: user.sessionExpiry,
        endTime: undefined,
        dataUsed: 0,
        isActive: false,
        remainingTime: 0,
      };
    } catch (error) {
      return null;
    }
  }

  async getSessionStatus(userId: string): Promise<{ isActive: boolean; remainingTime?: number }> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user || !user.isActive) {
        return { isActive: false };
      }

      const isActive = user.sessionExpiry && new Date() < user.sessionExpiry;
      const remainingTime = isActive ? 
        Math.max(0, user.sessionExpiry.getTime() - new Date().getTime()) : 0;

      return { isActive, remainingTime };
    } catch (error) {
      return { isActive: false };
    }
  }
}
