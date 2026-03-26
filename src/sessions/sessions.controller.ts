import { Controller, Get, UseGuards, Request, Logger } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiSecurity,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetSessionResponseDto, GetSessionStatusResponseDto } from './dto';

@ApiTags('Sessions')
@ApiBearerAuth('JWT')
@Controller('sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(private readonly sessionsService: SessionsService) {}

  @ApiOperation({
    summary: 'Get current user session details',
    description:
      'Retrieves detailed information about the currently authenticated user\'s session. ' +
      'This includes session ID, start time, data usage, and remaining session time. ' +
      'Requires a valid JWT token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session details retrieved successfully',
    type: GetSessionResponseDto,
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
  @Get('current')
  async getCurrentSession(@Request() req): Promise<GetSessionResponseDto | null> {
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

  @ApiOperation({
    summary: 'Get session status',
    description:
      'Retrieves the current status of an authenticated user\'s session. ' +
      'Returns whether the session is active and the remaining time in milliseconds. ' +
      'This is a lightweight endpoint useful for quick status checks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session status retrieved successfully',
    type: GetSessionStatusResponseDto,
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
  @Get('status')
  async getSessionStatus(@Request() req): Promise<GetSessionStatusResponseDto> {
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
