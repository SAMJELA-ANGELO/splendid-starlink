import {
  Controller,
  Request,
  Post,
  UseGuards,
  Body,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { SilentLoginDto } from './dto/silent-login.dto';
import { UsersService } from '../users/users.service';
import { PaymentsService } from '../payments/payments.service';
import { MikrotikService } from '../mikrotik/mikrotik.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private paymentsService: PaymentsService,
    private mikrotikService: MikrotikService,
  ) {}

  @ApiOperation({ summary: 'User login with username and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description:
      'Login successful, JWT token returned. For WiFi logins, also authenticates with MikroTik.',
    schema: {
      example: {
        success: true,
        message: 'Login successful',
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: { id: '507f1f77bcf86cd799439011', username: 'john_doe' },
          mikrotikAuth: {
            success: true,
            message: 'Authenticated with MikroTik',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Body() body: LoginDto) {
    this.logger.log(`🔑 ===== LOGIN ATTEMPT START =====`);
    this.logger.log(`🔑 Username: ${body.username}`);
    this.logger.log(`🔑 Request body:`, body);
    this.logger.log(
      `🔑 User from LocalAuthGuard:`,
      req.user
        ? {
            _id: req.user._id,
            username: req.user.username,
            isActive: req.user.isActive,
            sessionExpiry: req.user.sessionExpiry,
          }
        : 'No user found',
    );

    const user = req.user;
    const now = new Date();
    const planExpired =
      !user.isActive || !user.sessionExpiry || now > user.sessionExpiry;

    // Dashboard login is allowed even for expired users (they need access to renew)
    if (planExpired && !body.fromWifi) {
      this.logger.warn(
        `⚠️ Expired user ${body.username} logging in to dashboard for renewal`,
      );
    } else if (!planExpired) {
      this.logger.log(
        `✅ User has active plan, remaining: ${user.sessionExpiry}`,
      );
    }

    const result = await this.authService.login(req.user);

    // Add plan status to response (frontend uses this for banner/UI)
    result.data.planStatus = {
      planExpired,
      isActive: user.isActive,
      sessionExpiry: user.sessionExpiry,
      remainingHours: user.sessionExpiry
        ? Math.round(
            (user.sessionExpiry.getTime() - now.getTime()) / (1000 * 60 * 60),
          )
        : 0,
    };

    // If from WiFi with expired plan: do not activate MikroTik. This lets user access dashboard for renewal only.
    if (body.fromWifi && planExpired) {
      this.logger.warn(
        `⚠️ Expired user ${body.username} attempted WiFi login, skipping MikroTik activation`,
      );
      result.data.mikrotikAuth = {
        success: false,
        message:
          'Your subscription has expired. No internet access until plan is renewed.',
      };
    }

    // If coming from WiFi and plan is ACTIVE, authenticate with MikroTik.
    if (body.fromWifi && !planExpired) {
      this.logger.log(`📡 ===== WIFI LOGIN PROCESS START =====`);
      this.logger.log(
        `📡 WiFi login detected - authenticating with MikroTik for ${user.username}`,
      );
      this.logger.log(`📡 User MAC: ${user.macAddress || 'Not stored'}`);
      this.logger.log(`📡 Request MAC: ${body.macAddress || 'Not provided'}`);
      this.logger.log(
        `📡 Plan active: ${!planExpired}, expires: ${user.sessionExpiry}`,
      );

      // For returning users: if no MAC stored but user has active plan, grant access
      const shouldAuthenticate =
        user.macAddress ||
        body.macAddress ||
        (!user.macAddress && !planExpired);
      this.logger.log(`📡 Should authenticate: ${shouldAuthenticate}`);

      if (shouldAuthenticate) {
        try {
          // Ensure user exists on MikroTik with login password
          this.logger.log(`🔍 Checking if user exists on MikroTik: ${user.username}`);
          const userExistsOnMikrotik = await this.mikrotikService.userExists(user.username);
          
          if (!userExistsOnMikrotik) {
            this.logger.log(`➕ User ${user.username} not found on MikroTik - creating with login password`);
            await this.mikrotikService.createUser(user.username, body.password);
            this.logger.log(`✅ MikroTik user created for ${user.username}`);
          } else {
            this.logger.log(`✅ User ${user.username} already exists on MikroTik`);
          }

          // If MAC provided in login request, bind it
          if (body.macAddress) {
            // FIX: Decode URL-encoded MAC address (02%3A38... → 02:38:9C...)
            const decodedMac = decodeURIComponent(body.macAddress);
            this.logger.log(
              `📌 Binding MAC ${body.macAddress} → Decoded: ${decodedMac} for WiFi access`,
            );
            await this.mikrotikService.bindMacOnAvailableRouter(
              decodedMac,
              Math.ceil(
                (user.sessionExpiry.getTime() - now.getTime()) /
                  (1000 * 60 * 60),
              ),
            );
            this.logger.log(`✅ MAC binding completed`);
          }

          // Activate/create hotspot user
          this.logger.log(`🔄 Activating hotspot user...`);
          await this.mikrotikService.activateUser(
            user.username,
            Math.ceil(
              (user.sessionExpiry.getTime() - now.getTime()) / (1000 * 60 * 60),
            ),
          );
          this.logger.log(
            `✅ MikroTik authentication successful for ${user.username}`,
          );
          result.data.mikrotikAuth = {
            success: true,
            message: 'Authenticated with MikroTik',
          };
        } catch (mikrotikError: any) {
          this.logger.error(
            `❌ MikroTik authentication FAILED: ${mikrotikError.message}`,
          );
          this.logger.error(`❌ Error details:`, mikrotikError);
          result.data.mikrotikAuth = {
            success: false,
            message: mikrotikError.message,
          };
        }
      } else {
        this.logger.log(
          `ℹ️ Skipping MikroTik auth - no MAC and plan expired for ${user.username}`,
        );
        result.data.mikrotikAuth = {
          success: false,
          message: 'No active plan for WiFi access',
        };
      }
      this.logger.log(`📡 ===== WIFI LOGIN PROCESS END =====`);
    }
    this.logger.log(`🔄 Checking for active session to reconnect...`);
    const reconnectionStatus = await this.paymentsService.reconnectUserIfNeeded(
      req.user._id,
    );
    this.logger.log(`🔄 Reconnection status:`, reconnectionStatus);
    if (reconnectionStatus?.reconnected) {
      this.logger.log(
        `✅ User reconnected to WiFi: ${reconnectionStatus?.username} (${reconnectionStatus?.remainingHours}h remaining)`,
      );
    } else {
      this.logger.log(
        `ℹ️ No active session to reconnect: ${reconnectionStatus?.reason}`,
      );
    }

    this.logger.log(`✅ ===== LOGIN SUCCESSFUL =====`);
    this.logger.log(`✅ User: ${body.username}`);
    this.logger.log(`✅ Response data:`, result.data);
    this.logger.log(`✅ ===== LOGIN END =====`);
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
    if (body.macAddress) {
      this.logger.log(
        `   📌 WiFi Session: MAC=${body.macAddress}, Router=${body.routerIdentity || 'unknown'}`,
      );
    }

    try {
      const user = await this.usersService.create(
        body.username,
        body.password,
        body.macAddress,
        undefined, // ipAddress
        body.routerIdentity,
        false, // isGift
      );
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

  @ApiOperation({ summary: 'Check if MAC address has active plan' })
  @ApiBody({
    schema: {
      example: { mac: 'AA:BB:CC:DD:EE:FF' },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'MAC check result - returns username if user has active plan',
    schema: {
      example: {
        exists: true,
        username: 'john_doe',
        sessionExpiry: '2026-03-31T10:00:00Z',
        remainingHours: 24,
      },
    },
  })
  @Post('check-mac')
  async checkMac(@Body() body: { mac: string }) {
    this.logger.log(`📌 Checking MAC address status: ${body.mac}`);
    try {
      // First try to find user with active session
      const user = await this.usersService.findByMacWithActiveSession(body.mac);

      if (user) {
        this.logger.log(
          `✅ Active user found with MAC ${body.mac}: ${user.username}`,
        );
        return {
          exists: true,
          username: user.username,
          sessionExpiry: user.sessionExpiry,
          remainingHours: user.sessionExpiry
            ? Math.round(
                (user.sessionExpiry.getTime() - new Date().getTime()) /
                  (1000 * 60 * 60),
              )
            : 0,
          planStatus: 'active',
        };
      }

      // If no active user, check if there's a user with expired plan
      const expiredUser = await this.usersService.findByMacIncludingExpired(
        body.mac,
      );
      if (expiredUser) {
        this.logger.log(
          `⚠️ User with expired plan found with MAC ${body.mac}: ${expiredUser.username}`,
        );
        return {
          exists: true,
          username: expiredUser.username,
          sessionExpiry: expiredUser.sessionExpiry,
          remainingHours: 0,
          planStatus: 'expired',
          message:
            'Your subscription has expired. Please login to renew your plan.',
        };
      }

      // No user found with this MAC
      this.logger.log(`ℹ️ No user found with MAC: ${body.mac}`);
      return {
        exists: false,
        message: 'No subscription found for this device',
      };
    } catch (error: any) {
      this.logger.error(`❌ MAC check failed: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Perform silent login to MikroTik hotspot' })
  @ApiBody({ type: SilentLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Silent login successful - user is now connected to hotspot',
    schema: {
      example: {
        success: true,
        message: 'Silent login successful',
        data: {
          activeRouter: 'Home',
          note: 'User is now actively connected to the hotspot',
        },
      },
    },
  })
  @Post('silent-login')
  async silentLogin(@Body() body: SilentLoginDto) {
    this.logger.log(`🔐 ===== SILENT LOGIN START =====`);
    this.logger.log(`🔐 Username: ${body.username}`);
    this.logger.log(`🔐 Password: [HIDDEN]`);
    this.logger.log(`🔐 MAC Address: ${body.macAddress}`);
    this.logger.log(`🔐 IP Address: ${body.ipAddress}`);
    this.logger.log(`🔐 Duration Hours: ${body.durationHours}`);
    this.logger.log(`🔐 Full request body:`, body);

    try {
      // Call MikroTik service to perform silent login
      this.logger.log(`🔄 Calling MikroTik SilentLogin service...`);
      const result = await this.mikrotikService.silentLogin(
        body.username,
        body.password,
        body.macAddress,
        body.ipAddress,
        body.durationHours,
      );
      this.logger.log(`✅ Silent login successful on router: ${result}`);
      this.logger.log(`✅ ===== SILENT LOGIN SUCCESS =====`);
      return {
        success: true,
        message: 'Silent login successful',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`❌ ===== SILENT LOGIN FAILED =====`);
      this.logger.error(`❌ Error message: ${error.message}`);
      this.logger.error(`❌ Error stack:`, error.stack);
      this.logger.error(`❌ Full error object:`, error);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Recover/view current password' })
  @ApiResponse({
    status: 200,
    description: 'Password recovery successful',
    schema: {
      example: {
        success: true,
        message: 'Password recovered successfully',
        data: {
          username: 'john_doe',
          currentPassword: 'mySecretPass123',
          lastChanged: '2024-01-15T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Post('recover-password')
  async recoverPassword(@Body() body: { username: string }) {
    this.logger.log(`🔑 Password recovery requested for username: ${body.username}`);

    try {
      const user = await this.usersService.findByUsername(body.username);
      if (!user) {
        throw new Error('User not found');
      }

      // Return the plain password (SECURITY RISK - as requested)
      const result = {
        success: true,
        message: 'Password recovered successfully',
        data: {
          username: user.username,
          currentPassword: user.plainPassword,
          lastChanged: user.updatedAt || user.createdAt,
          macAddress: user.macAddress,
          isActive: user.isActive,
        },
      };

      this.logger.log(`✅ Password recovered for user: ${body.username}`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Password recovery failed for ${body.username}: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      example: {
        success: true,
        message: 'Password changed successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('change-password')
  async changePassword(@Body() body: { username: string; newPassword: string }) {
    this.logger.log(`🔄 Password change requested for username: ${body.username}`);

    try {
      const user = await this.usersService.findByUsername(body.username);
      if (!user) {
        throw new Error('User not found');
      }

      // Update password in both MongoDB and MikroTik
      await this.usersService.updatePassword(user.username, body.newPassword);

      const result = {
        success: true,
        message: 'Password changed successfully',
      };

      this.logger.log(`✅ Password changed for user: ${body.username}`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Password change failed for ${body.username}: ${error.message}`);
      throw error;
    }
  }
}
