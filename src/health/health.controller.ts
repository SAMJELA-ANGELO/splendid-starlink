import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-03-22T17:10:00.000Z',
        uptime: 3600,
        service: 'starlink-hotspot-api',
        version: '1.0.0',
        environment: 'development',
      },
    },
  })
  @Get()
  getHealth() {
    this.logger.log(`🏥 Health check requested`);
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'starlink-hotspot-api',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @ApiOperation({ summary: 'Simple ping endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Ping response',
    schema: {
      example: { message: 'pong' },
    },
  })
  @Get('ping')
  ping() {
    this.logger.log(`🔔 Ping request received`);
    return { message: 'pong' };
  }

  @ApiOperation({ summary: 'Detailed health check with dependencies' })
  @ApiResponse({
    status: 200,
    description: 'Detailed health status',
  })
  @Get('detailed')
  async getDetailedHealth() {
    this.logger.log(`🔍 Detailed health check requested`);
    // This could be expanded to check database, external services, etc.
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'starlink-hotspot-api',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      dependencies: {
        database: 'connected', // Could add actual DB health check
        mikrotik: 'connected', // Could add actual Mikrotik health check
        fapshi: 'available', // Could add actual Fapshi health check
      },
    };
    this.logger.log(`✅ Detailed health check complete`);
    return health;
  }
}
