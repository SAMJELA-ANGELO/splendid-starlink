import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminSeederService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(private usersService: UsersService) {}

  async onModuleInit() {
    const existing = await this.usersService.findByUsername('splendid');
    if (existing) {
      this.logger.log('Admin user already exists: splendid');
      return;
    }

    const adminPassword = 'To2dayPips';
    await this.usersService.create('splendid', adminPassword);
    this.logger.log('Admin user created: splendid');
    this.logger.log(
      'Use username "splendid" + password "To2dayPips" to login and access plans endpoints',
    );
  }
}
