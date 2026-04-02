import {
  Controller,
  Post,
  Get,
  Body,
  Logger,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SignupDto } from '../auth/dto/signup.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Create a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User successfully created',
    schema: {
      example: {
        message: 'User created',
        user: { id: '507f1f77bcf86cd799439011', username: 'john_doe' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or user already exists',
  })
  @Post('signup')
  async signup(@Body() body: SignupDto) {
    this.logger.log(`👤 User signup requested for username: ${body.username}`);
    try {
      const user = await this.usersService.create(body.username, body.password);
      this.logger.log(
        `✅ User created successfully with ID: ${user._id?.toString()}, Username: ${user.username}`,
      );
      return {
        message: 'User created',
        user: { id: user._id?.toString(), username: user.username },
      };
    } catch (error) {
      this.logger.error(
        `❌ User creation failed for username: ${body.username}: ${error.message}`,
      );
      throw error;
    }
  }

  // /users/me endpoint removed as requested
}
