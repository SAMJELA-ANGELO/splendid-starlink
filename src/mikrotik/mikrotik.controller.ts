import {
  Controller,
  Post,
  Delete,
  Body,
  Get,
  UseGuards,
  Param,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiBody,
} from '@nestjs/swagger';
import { MikrotikService } from './mikrotik.service';
import { ActivateUserDto } from './dto/activate-user.dto';
import { DisableUserDto } from './dto/disable-user.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('MikroTik')
@Controller('mikrotik')
export class MikrotikController {
  private readonly logger = new Logger(MikrotikController.name);

  constructor(private readonly mikrotikService: MikrotikService) {}

  @ApiOperation({ summary: 'Test MikroTik connection' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Connection test result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('test-connection')
  async testConnection() {
    this.logger.log(`🌐 MikroTik connection test initiated`);
    try {
      const result = await this.mikrotikService.testConnection();
      this.logger.log(`✅ MikroTik connection successful`);
      return { message: 'MikroTik connection successful', data: result };
    } catch (error) {
      this.logger.error(`❌ MikroTik connection test failed: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({ summary: 'List all hotspot users' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of hotspot users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('users')
  async listUsers() {
    this.logger.log(`📋 Listing all hotspot users from MikroTik`);
    try {
      const users = await this.mikrotikService.listHotspotUsers();
      this.logger.log(`✅ Retrieved ${users.length} hotspot users`);
      return { users };
    } catch (error) {
      this.logger.error(`❌ Failed to list hotspot users: ${error.message}`);
      throw error;
    }
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
    this.logger.log(`🔍 Fetching details for MikroTik user: ${username}`);
    try {
      const user = await this.mikrotikService.getUserDetails(username);
      if (!user) {
        this.logger.warn(`⚠️ User ${username} not found on MikroTik`);
        return { message: `User ${username} not found` };
      }
      this.logger.log(`✅ User details retrieved for: ${username}`);
      return { user };
    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch user details for ${username}: ${error.message}`,
      );
      throw error;
    }
  }

  @ApiOperation({ summary: 'List all active hotspot users' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of active users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('active-users')
  async getActiveUsers() {
    this.logger.log(`🟢 Fetching active hotspot users from MikroTik`);
    try {
      const activeUsers = await this.mikrotikService.getActiveUsers();
      this.logger.log(`✅ Retrieved ${activeUsers.length} active users`);
      return { activeUsers };
    } catch (error) {
      this.logger.error(`❌ Failed to fetch active users: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Activate a user on MikroTik hotspot' })
  @ApiBody({ type: ActivateUserDto })
  @ApiBearerAuth()
  @ApiResponse({ status: 201, description: 'User activated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('activate')
  async activateUser(@Body() body: ActivateUserDto) {
    this.logger.log(
      `⏱️ Activating MikroTik user: ${body.username} for ${body.durationHours} hours`,
    );
    try {
      await this.mikrotikService.activateUser(
        body.username,
        body.durationHours,
      );
      this.logger.log(
        `✅ User ${body.username} activated successfully for ${body.durationHours} hours`,
      );
      return {
        message: `User ${body.username} activated for ${body.durationHours} hours`,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to activate user ${body.username}: ${error.message}`,
      );
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Deactivate a user on MikroTik hotspot (disable account)',
  })
  @ApiBody({ type: DisableUserDto })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('disable')
  async disableUser(@Body() body: DisableUserDto) {
    this.logger.log(
      `🔒 Disabling MikroTik user: ${body.username} (account kept)`,
    );
    try {
      await this.mikrotikService.disableUser(body.username);
      this.logger.log(
        `✅ User ${body.username} disabled successfully (account retained)`,
      );
      return { message: `User ${body.username} disabled (account kept)` };
    } catch (error) {
      this.logger.error(
        `❌ Failed to disable user ${body.username}: ${error.message}`,
      );
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Delete a user from MikroTik hotspot (permanently remove)',
  })
  @ApiBody({ type: DeleteUserDto })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('delete')
  async deleteUser(@Body() body: DeleteUserDto) {
    this.logger.log(`🗑️ Permanently deleting MikroTik user: ${body.username}`);
    try {
      await this.mikrotikService.deleteUser(body.username);
      this.logger.log(
        `✅ User ${body.username} permanently deleted from MikroTik`,
      );
      return { message: `User ${body.username} permanently deleted` };
    } catch (error) {
      this.logger.error(
        `❌ Failed to delete user ${body.username}: ${error.message}`,
      );
      throw error;
    }
  }

  @ApiOperation({
    summary:
      'Deactivate a user on MikroTik hotspot (DEPRECATED - use /delete instead)',
  })
  @ApiBody({ type: DisableUserDto })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('deactivate')
  async deactivateUser(@Body() body: DisableUserDto) {
    this.logger.warn(
      `⛔ DEPRECATED: Deactivate endpoint called for ${body.username} (use /delete instead)`,
    );
    try {
      // Kept for backwards compatibility - calls delete which removes the user
      await this.mikrotikService.deactivateUser(body.username);
      this.logger.log(
        `✅ User ${body.username} deactivated (via deprecated endpoint)`,
      );
      return { message: `User ${body.username} deactivated` };
    } catch (error) {
      this.logger.error(
        `❌ Failed to deactivate user ${body.username}: ${error.message}`,
      );
      throw error;
    }
  }
}
