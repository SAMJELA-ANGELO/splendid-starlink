import { Controller, Request, Post, UseGuards, Body, Logger } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UsersService } from '../users/users.service';
import { PaymentsService } from '../payments/payments.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private paymentsService: PaymentsService,
  ) {}

  @ApiOperation({ summary: 'User login with username and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, JWT token returned',
    schema: {
      example: {
        success: true,
        message: 'Login successful',
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: { id: '507f1f77bcf86cd799439011', username: 'john_doe' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Body() body: LoginDto) {
    this.logger.log(`🔑 Login attempt for user: ${body.username}`);
    const result = await this.authService.login(req.user);
    
    // Auto-reconnect user to WiFi if they have an active session
    this.logger.log(`🔄 Checking for active session to reconnect...`);
    const reconnectionStatus = await this.paymentsService.reconnectUserIfNeeded(req.user._id);
    if (reconnectionStatus?.reconnected) {
      this.logger.log(`✅ User reconnected to WiFi: ${reconnectionStatus?.username} (${reconnectionStatus?.remainingHours}h remaining)`);
    } else {
      this.logger.log(`ℹ️ No active session to reconnect: ${reconnectionStatus?.reason}`);
    }
    
    this.logger.log(`✅ Login successful for user: ${body.username}`);
    return result;
  }

  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      example: {
        success: true,
        message: 'User created successfully',
        data: {
          user: { id: '507f1f77bcf86cd799439011', username: 'john_doe' },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or user already exists',
  })
  @Post('register')
  async register(@Body() body: SignupDto) {
    this.logger.log(`📝 Registration attempt for user: ${body.username}`);
    try {
      const user = await this.usersService.create(body.username, body.password);
      this.logger.log(
        `✅ User registered successfully: ${body.username} (ID: ${user._id})`,
      );
      
      // Auto-login after registration to get token
      const loginResult = await this.authService.login(user);
      this.logger.log(
        `✅ User auto-logged in after registration: ${body.username}`,
      );
      
      // Return the login result which includes the token
      return loginResult;
    } catch (error: any) {
      this.logger.error(
        `❌ Registration failed for user: ${body.username} - ${error.message}`,
      );
      throw error;
    }
  }
}
