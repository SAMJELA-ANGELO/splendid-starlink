import { Controller, Get, UseGuards, Request, Logger, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecentActivityResponseDto, ActivityStatsDto } from './dto/activity.dto';

@ApiTags('Activities')
@ApiBearerAuth('JWT')
@Controller('activities')
export class ActivitiesController {
  private readonly logger = new Logger(ActivitiesController.name);

  constructor(private readonly activitiesService: ActivitiesService) {}

  @ApiOperation({
    summary: 'Get recent user activities',
    description:
      'Retrieves paginated list of recent activities for the authenticated user, including ' +
      'payments, sessions, connections, and account actions. Activities are sorted by most recent.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent activities retrieved successfully',
    type: RecentActivityResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - No valid JWT token provided',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Records per page (default: 10, max: 50)',
    example: 10,
  })
  @UseGuards(JwtAuthGuard)
  @Get('recent')
  async getRecentActivities(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<RecentActivityResponseDto> {
    const requestedPage = page || 1;
    const requestedPageSize = Math.min(pageSize || 10, 50); // Cap at 50 per page
    this.logger.log(
      `📋 Recent activities requested for user: ${req.user.userId}, page: ${requestedPage}, size: ${requestedPageSize}`,
    );

    try {
      const activities = await this.activitiesService.getRecentActivities(
        req.user.userId,
        requestedPage,
        requestedPageSize,
      );
      this.logger.log(
        `✅ Recent activities retrieved for user: ${req.user.userId}, Total: ${activities.total}`,
      );
      return activities;
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve recent activities for user: ${req.user.userId}: ${error.message}`,
      );
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Get current month activity statistics',
    description:
      'Retrieves aggregated activity statistics for the current calendar month, including ' +
      'successful/failed actions, payment count, and total hours of service.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity statistics retrieved successfully',
    type: ActivityStatsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - No valid JWT token provided',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getActivityStats(@Request() req: any): Promise<ActivityStatsDto> {
    this.logger.log(`📊 Activity stats requested for user: ${req.user.userId}`);

    try {
      const stats = await this.activitiesService.getActivityStats(req.user.userId);
      this.logger.log(`✅ Activity stats retrieved for user: ${req.user.userId}`);
      return stats;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve activity stats for user: ${req.user.userId}: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Get activities by category',
    description:
      'Retrieve activities filtered by a specific category (payment, session, connection, account, system).',
  })
  @ApiResponse({
    status: 200,
    description: 'Activities retrieved successfully',
    type: RecentActivityResponseDto,
  })
  @ApiQuery({
    name: 'category',
    required: true,
    type: String,
    enum: ['payment', 'session', 'connection', 'account', 'system'],
    description: 'Activity category to filter',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @UseGuards(JwtAuthGuard)
  @Get('by-category')
  async getActivitiesByCategory(
    @Request() req: any,
    @Query('category') category: string,
    @Query('page') page?: number,
  ): Promise<RecentActivityResponseDto> {
    this.logger.log(
      `🔍 Activities by category requested for user: ${req.user.userId}, category: ${category}`,
    );

    try {
      const activities = await this.activitiesService.getActivitiesByCategory(
        req.user.userId,
        category,
        page || 1,
        10,
      );
      this.logger.log(
        `✅ Activities retrieved for user: ${req.user.userId}, category: ${category}, Total: ${activities.total}`,
      );
      return activities;
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve activities for user: ${req.user.userId}: ${error.message}`,
      );
      throw error;
    }
  }
}
