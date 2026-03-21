import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @ApiOperation({ summary: 'Get current user session' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Current session retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('current')
  async getCurrentSession(@Request() req) {
    const session = await this.sessionsService.getCurrentSession(req.user.userId);
    return session;
  }

  @ApiOperation({ summary: 'Get session status' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Session status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getSessionStatus(@Request() req) {
    const status = await this.sessionsService.getSessionStatus(req.user.userId);
    return status;
  }
}
