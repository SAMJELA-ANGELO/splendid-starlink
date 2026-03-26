import { Controller, Get, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Sessions')
@Controller('sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(private readonly sessionsService: SessionsService) {}

  @ApiOperation({ summary: 'Get current user session' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Current session retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('current')
  async getCurrentSession(@Request() req) {
    this.logger.log(`📊 Current session requested for user: ${req.user.userId}`);
    try {
      const session = await this.sessionsService.getCurrentSession(req.user.userId);
      this.logger.log(`✅ Current session retrieved for user: ${req.user.userId}`);
      return session;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve current session for user: ${req.user.userId}: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get session status' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Session status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getSessionStatus(@Request() req) {
    this.logger.log(`⏱️ Session status requested for user: ${req.user.userId}`);
    try {
      const status = await this.sessionsService.getSessionStatus(req.user.userId);
      this.logger.log(`✅ Session status retrieved for user: ${req.user.userId}, Active: ${status.isActive}`);
      return status;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve session status for user: ${req.user.userId}: ${error.message}`);
      throw error;
    }
  }
}
