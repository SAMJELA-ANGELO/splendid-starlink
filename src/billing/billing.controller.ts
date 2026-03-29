import { Controller, Get, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingHistoryResponseDto, BillingStatsDto } from './dto';

@ApiTags('Billing')
@ApiBearerAuth('JWT')
@Controller('user/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billingService: BillingService) {}

  @ApiOperation({
    summary: 'Get user billing history',
    description:
      'Retrieves the complete billing history for the authenticated user, including all payments, invoices, ' +
      'plan information, and spending statistics. Shows both successful and failed transactions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing history retrieved successfully',
    type: BillingHistoryResponseDto,
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
  @Get()
  async getBillingHistory(@Request() req: any): Promise<BillingHistoryResponseDto> {
    this.logger.log(`📋 Billing history requested for user: ${req.user.userId}`);
    try {
      const billingHistory = await this.billingService.getBillingHistory(req.user.userId);
      this.logger.log(
        `✅ Billing history retrieved for user: ${req.user.userId}, Total: ${billingHistory.totalInvoices} invoices`,
      );
      return billingHistory;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve billing history for user: ${req.user.userId}: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Get user billing statistics',
    description:
      'Retrieves aggregated billing statistics for the authenticated user, including total spent, ' +
      'number of successful/failed payments, total hours purchased, and date ranges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing statistics retrieved successfully',
    type: BillingStatsDto,
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
  async getBillingStats(@Request() req: any): Promise<BillingStatsDto> {
    this.logger.log(`📊 Billing stats requested for user: ${req.user.userId}`);
    try {
      const stats = await this.billingService.getBillingStats(req.user.userId);
      this.logger.log(
        `✅ Billing stats retrieved for user: ${req.user.userId}, Total spent: ${stats.totalSpent} CFA`,
      );
      return stats;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve billing stats for user: ${req.user.userId}: ${error.message}`);
      throw error;
    }
  }
}
