import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
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
        environment: 'development'
      }
    },
  })
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'starlink-hotspot-api',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  @ApiOperation({ summary: 'Simple ping endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Ping response',
    schema: {
      example: { message: 'pong' }
    },
  })
  @Get('ping')
  ping() {
    return { message: 'pong' };
  }

  @ApiOperation({ summary: 'Detailed health check with dependencies' })
  @ApiResponse({
    status: 200,
    description: 'Detailed health status',
  })
  @Get('detailed')
  async getDetailedHealth() {
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
        fapshi: 'available' // Could add actual Fapshi health check
      }
    };
    return health;
  }
}
