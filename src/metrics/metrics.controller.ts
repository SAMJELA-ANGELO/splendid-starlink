import { Controller, Get, UseGuards, Request, Logger, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConnectionMetricsResponseDto, HistoricalMetricsDto } from './dto';

@ApiTags('Metrics')
@ApiBearerAuth('JWT')
@Controller('connection/metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  @ApiOperation({
    summary: 'Get current connection metrics',
    description:
      'Retrieves real-time metrics for the user\'s active connection, including download/upload speed, ' +
      'latency, and signal strength. Returns mock data if no active session or router is unreachable.',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics retrieved successfully',
    type: ConnectionMetricsResponseDto,
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
  async getCurrentMetrics(@Request() req: any): Promise<ConnectionMetricsResponseDto> {
    this.logger.log(`📊 Current metrics requested for user: ${req.user.userId}`);
    try {
      const metrics = await this.metricsService.getCurrentMetrics(req.user.userId);
      this.logger.log(
        `✅ Current metrics retrieved for user: ${req.user.userId}, Connected: ${metrics.isConnected}`,
      );
      return metrics;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve metrics for user: ${req.user.userId}: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Get historical metrics',
    description:
      'Retrieves historical metrics data for the specified time period (default: last 24 hours). ' +
      'Includes data points at regular intervals and calculated averages.',
  })
  @ApiResponse({
    status: 200,
    description: 'Historical metrics retrieved successfully',
    type: HistoricalMetricsDto,
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
    name: 'hours',
    required: false,
    type: Number,
    description: 'Number of hours to retrieve history for (default: 24, max: 168)',
    example: 24,
  })
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getHistoricalMetrics(@Request() req: any, @Query('hours') hours?: number): Promise<HistoricalMetricsDto> {
    const requestedHours = Math.min(hours || 24, 168); // Max 7 days
    this.logger.log(
      `📈 Historical metrics requested for user: ${req.user.userId}, hours: ${requestedHours}`,
    );
    try {
      const metrics = await this.metricsService.getHistoricalMetrics(req.user.userId, requestedHours);
      this.logger.log(
        `✅ Historical metrics retrieved for user: ${req.user.userId}, Data points: ${metrics.measurements.length}`,
      );
      return metrics;
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve historical metrics for user: ${req.user.userId}: ${error.message}`,
      );
      throw error;
    }
  }
}
