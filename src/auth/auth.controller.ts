import { Controller, Request, Post, UseGuards, Body, Get, BadRequestException, UnauthorizedException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UsersService } from '../users/users.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
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
        data: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        user: { id: '507f1f77bcf86cd799439011', username: 'john_doe', isActive: true }
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    // LocalAuthGuard handles authentication and returns 401 if invalid
    // If we reach here, authentication was successful
    const result = await this.authService.login(req.user);
    
    return {
      success: true,
      message: 'Login successful',
      data: result,
      user: {
        id: (req.user._id as unknown as string),
        username: req.user.username,
        isActive: req.user.isActive
      }
    };
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
        user: { id: '507f1f77bcf86cd799439011', username: 'john_doe' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'Username already exists',
  })
  @ApiResponse({
    status: 500,
    description: 'Registration failed',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 signup attempts per minute
  @Post('register')
  async register(@Body() body: SignupDto) {
    try {
      // Validate input
      if (!body.username || !body.password) {
        throw new BadRequestException('Username and password are required');
      }

      if (body.username.length < 3) {
        throw new BadRequestException('Username must be at least 3 characters long');
      }

      if (body.password.length < 6) {
        throw new BadRequestException('Password must be at least 6 characters long');
      }

      // Check if username contains only valid characters
      if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
        throw new BadRequestException('Username can only contain letters, numbers, and underscores');
      }

      const user = await this.usersService.create(body.username, body.password);
      
      return {
        success: true,
        message: 'User created successfully',
        user: { 
          id: (user._id as unknown as string), 
          username: user.username,
          isActive: user.isActive
        }
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Handle duplicate username error
      if (error.code === 11000 || error.message.includes('duplicate')) {
        throw new ConflictException('Username already exists. Please choose a different username.');
      }
      
      throw new InternalServerErrorException('Registration failed. Please try again later.');
    }
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile retrieved',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.userId);
    return user;
  }
}
