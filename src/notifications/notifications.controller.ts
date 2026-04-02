import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionNotificationService } from './session-notification.service';
import { PaymentStatusNotificationService } from './payment-status-notification.service';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly sessionNotificationService: SessionNotificationService,
    private readonly paymentNotificationService: PaymentStatusNotificationService,
  ) {}

  @ApiOperation({
    summary: 'Manually trigger session notification check',
    description:
      'Manually run the session notification check to send warnings for expiring sessions. ' +
      'Useful for testing. In production, this runs automatically every 2 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification check completed',
    schema: {
      example: {
        message: 'Session notification check completed',
        timestamp: '2026-03-27T00:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - No valid JWT token provided',
  })
  @Post('check-session')
  @UseGuards(JwtAuthGuard)
  async checkSessionNotifications() {
    this.logger.log(`🔄 Manual session notification check triggered by user`);
    await this.sessionNotificationService.handleSessionNotifications();
    return {
      message: 'Session notification check completed',
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({
    summary: 'Manually trigger payment notification check',
    description:
      'Manually run the payment notification check to send payment status notifications. ' +
      'Useful for testing. In production, this runs automatically every 1 minute.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment notification check completed',
    schema: {
      example: {
        message: 'Payment notification check completed',
        timestamp: '2026-03-27T00:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - No valid JWT token provided',
  })
  @Post('check-payments')
  @UseGuards(JwtAuthGuard)
  async checkPaymentNotifications() {
    this.logger.log(`🔄 Manual payment notification check triggered by user`);
    await this.paymentNotificationService.handlePaymentNotifications();
    return {
      message: 'Payment notification check completed',
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({
    summary: 'Reset session notification flags for testing',
    description:
      'Reset notification flags for a specific user to re-test session notifications. ' +
      'This allows re-sending the same notifications for testing purposes.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to reset notification flags for',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification flags reset successfully',
    schema: {
      example: {
        message:
          'Session notification flags reset for user: 507f1f77bcf86cd799439011',
        timestamp: '2026-03-27T00:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - No valid JWT token provided',
  })
  @Post('reset-session-flags/:userId')
  @UseGuards(JwtAuthGuard)
  async resetSessionNotificationFlags(@Param('userId') userId: string) {
    this.logger.log(
      `🔄 Resetting session notification flags for user: ${userId}`,
    );
    await this.sessionNotificationService.resetNotificationFlags(userId);
    return {
      message: `Session notification flags reset for user: ${userId}`,
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({
    summary: 'Reset payment notification flags for testing',
    description:
      'Reset notification flags for a specific payment to re-test payment notifications. ' +
      'This allows re-sending the same notifications for testing purposes.',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'Payment ID to reset notification flags for',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification flags reset successfully',
    schema: {
      example: {
        message:
          'Payment notification flags reset for: 507f1f77bcf86cd799439011',
        timestamp: '2026-03-27T00:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - No valid JWT token provided',
  })
  @Post('reset-payment-flags/:paymentId')
  @UseGuards(JwtAuthGuard)
  async resetPaymentNotificationFlags(@Param('paymentId') paymentId: string) {
    this.logger.log(
      `🔄 Resetting payment notification flags for: ${paymentId}`,
    );
    await this.paymentNotificationService.resetNotificationFlags(paymentId);
    return {
      message: `Payment notification flags reset for: ${paymentId}`,
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({
    summary: 'Get notification system status',
    description:
      'Get current status and information about the notification system, including cron schedules and last run times.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification system status retrieved',
    schema: {
      example: {
        system: 'Notifications',
        status: 'active',
        services: [
          {
            name: 'SessionNotificationService',
            schedule: 'Every 2 minutes',
            description: 'Checks for expiring sessions and sends warnings',
          },
          {
            name: 'PaymentStatusNotificationService',
            schedule: 'Every 1 minute',
            description:
              'Checks payment status changes and sends notifications',
          },
        ],
        timestamp: '2026-03-27T00:30:00Z',
      },
    },
  })
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getNotificationStatus() {
    this.logger.log(`📊 Notification system status requested`);
    return {
      system: 'Notifications',
      status: 'active',
      services: [
        {
          name: 'SessionNotificationService',
          schedule: 'Every 2 minutes (*/2 * * * *)',
          description:
            'Checks for expiring sessions and sends warnings at 30 min, 10 min, and at expiry',
          endpoints: [
            '/notifications/check-session',
            '/notifications/reset-session-flags/:userId',
          ],
        },
        {
          name: 'PaymentStatusNotificationService',
          schedule: 'Every 1 minute (*/1 * * * *)',
          description:
            'Checks payment status changes and sends initiated/success/failed notifications',
          endpoints: [
            '/notifications/check-payments',
            '/notifications/reset-payment-flags/:paymentId',
          ],
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
