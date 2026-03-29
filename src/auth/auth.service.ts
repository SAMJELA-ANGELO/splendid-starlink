import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);
    if (
      user &&
      (await this.usersService.validatePassword(password, user.password))
    ) {
      const userObj = (user as any).toObject();
      const { password: _, ...result } = userObj;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user._id };
    const token = this.jwtService.sign(payload);
    return {
      success: true,
      message: 'Login successful',
      data: {
        token,
        access_token: token,
        expires_in: 3600,
        token_type: 'Bearer',
        user: {
          userId: user._id.toString(),
          username: user.username,
        },
      },
    };
  }
}
