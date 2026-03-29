import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activity, ActivityDocument } from '../schemas/activity.schema';
import { ActivityDto, RecentActivityResponseDto, ActivityStatsDto } from './dto/activity.dto';
import { Plan, PlanDocument } from '../schemas/plan.schema';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
  ) {}

  /**
   * Log a user activity
   */
  async logActivity(
    userId: string,
    action: string,
    category: string,
    description: string,
    status: string = 'success',
    details?: Record<string, any>,
    ipAddress?: string,
    routing?: { routerIdentity?: string; sessionId?: string },
  ): Promise<ActivityDocument> {
    try {
      const activity = new this.activityModel({
        userId,
        action,
        category,
        description,
        status,
        details: details || {},
        ipAddress,
        routerIdentity: routing?.routerIdentity,
        sessionId: routing?.sessionId,
        timestamp: new Date(),
      });

      await activity.save();
      this.logger.debug(`📝 Activity logged for user ${userId}: ${action}`);
      return activity;
    } catch (error) {
      this.logger.error(`❌ Failed to log activity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recent activities for a user
   */
  async getRecentActivities(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<RecentActivityResponseDto> {
    this.logger.log(`📋 Fetching recent activities for user: ${userId}, page: ${page}`);

    try {
      const skip = (page - 1) * pageSize;

      // Get total count
      const total = await this.activityModel.countDocuments({ userId });

      // Get paginated activities, sorted by most recent first
      const activities = await this.activityModel
        .find({ userId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      if (!activities) {
        this.logger.log(`ℹ️ No activities found for user: ${userId}`);
        return {
          activities: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }

      // Transform to DTOs
      const activityDtos: ActivityDto[] = activities.map((activity: any) => ({
        id: activity._id?.toString(),
        action: activity.action,
        category: activity.category,
        description: activity.description,
        status: activity.status,
        details: activity.details,
        timestamp: activity.timestamp,
        routerIdentity: activity.routerIdentity,
      }));

      const totalPages = Math.ceil(total / pageSize);

      this.logger.log(
        `✅ Recent activities retrieved for user: ${userId}, Total: ${total}, Page: ${page}/${totalPages}`,
      );

      return {
        activities: activityDtos,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to fetch recent activities for user: ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get activity statistics for current month
   */
  async getActivityStats(userId: string): Promise<ActivityStatsDto> {
    this.logger.log(`📊 Fetching activity stats for user: ${userId}`);

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Get activities for this month
      const monthActivities = await this.activityModel
        .find({
          userId,
          timestamp: { $gte: monthStart, $lte: monthEnd },
        })
        .lean();

      // Get successful and failed counts
      const successfulActionsThisMonth = monthActivities.filter((a: any) => a.status === 'success')
        .length;
      const failedActionsThisMonth = monthActivities.filter((a: any) => a.status === 'failed')
        .length;

      // Get payment count
      const paymentsThisMonth = monthActivities.filter((a: any) => a.category === 'payment')
        .length;

      // Calculate total hours from session-related activities
      let hoursServiceActiveThisMonth = 0;
      monthActivities.forEach((activity: any) => {
        if (activity.category === 'payment' && activity.details?.duration) {
          hoursServiceActiveThisMonth += activity.details.duration;
        }
      });

      const stats: ActivityStatsDto = {
        successfulActionsThisMonth,
        failedActionsThisMonth,
        paymentsThisMonth,
        hoursServiceActiveThisMonth,
        monthStart,
        monthEnd,
      };

      this.logger.log(
        `✅ Activity stats retrieved for user: ${userId}, Successful: ${successfulActionsThisMonth}, Failed: ${failedActionsThisMonth}`,
      );
      return stats;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch activity stats for user: ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search activities by category
   */
  async getActivitiesByCategory(
    userId: string,
    category: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<RecentActivityResponseDto> {
    this.logger.log(`🔍 Fetching ${category} activities for user: ${userId}`);

    try {
      const skip = (page - 1) * pageSize;

      const total = await this.activityModel.countDocuments({ userId, category });
      const activities = await this.activityModel
        .find({ userId, category })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      const activityDtos: ActivityDto[] = activities.map((activity: any) => ({
        id: activity._id?.toString(),
        action: activity.action,
        category: activity.category,
        description: activity.description,
        status: activity.status,
        details: activity.details,
        timestamp: activity.timestamp,
        routerIdentity: activity.routerIdentity,
      }));

      const totalPages = Math.ceil(total / pageSize);

      return {
        activities: activityDtos,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch ${category} activities for user: ${userId}: ${error.message}`,
      );
      throw error;
    }
  }
}
