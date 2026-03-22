import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionCleanupService } from './session-cleanup.service';
import { UsersModule } from '../users/users.module';
import { MikrotikModule } from '../mikrotik/mikrotik.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    UsersModule,
    MikrotikModule,
  ],
  providers: [SessionCleanupService],
  exports: [SessionCleanupService],
})
export class SessionCleanupModule {}
