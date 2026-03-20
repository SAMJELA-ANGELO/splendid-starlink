import { Controller, Post, Delete, Body, Get, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { MikrotikService } from './mikrotik.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('MikroTik')
@Controller('mikrotik')
export class MikrotikController {
  constructor(private readonly mikrotikService: MikrotikService) {}

  @ApiOperation({ summary: 'Test MikroTik connection' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Connection test result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('test-connection')
  async testConnection() {
    const result = await this.mikrotikService.testConnection();
    return { message: 'MikroTik connection successful', data: result };
  }

  @ApiOperation({ summary: 'List all hotspot users' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of hotspot users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('users')
  async listUsers() {
    const users = await this.mikrotikService.listHotspotUsers();
    return { users };
  }

  @ApiOperation({ summary: 'Get details of a specific hotspot user' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('users/:username')
  async getUserDetails(@Param('username') username: string) {
    const user = await this.mikrotikService.getUserDetails(username);
    if (!user) {
      return { message: `User ${username} not found` };
    }
    return { user };
  }

  @ApiOperation({ summary: 'List all active hotspot users' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of active users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('active-users')
  async getActiveUsers() {
    const activeUsers = await this.mikrotikService.getActiveUsers();
    return { activeUsers };
  }

  @ApiOperation({ summary: 'Activate a user on MikroTik hotspot' })
  @ApiBearerAuth()
  @ApiResponse({ status: 201, description: 'User activated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('activate')
  async activateUser(@Body() body: { username: string; durationHours: number }) {
    await this.mikrotikService.activateUser(body.username, body.durationHours);
    return { message: `User ${body.username} activated for ${body.durationHours} hours` };
  }

  @ApiOperation({ summary: 'Deactivate a user on MikroTik hotspot' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('deactivate')
  async deactivateUser(@Body() body: { username: string }) {
    await this.mikrotikService.deactivateUser(body.username);
    return { message: `User ${body.username} deactivated` };
  }
}
