import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionCleanupService } from './session-cleanup.service';
import { UsersModule } from '../users/users.module';
import { MikrotikModule } from '../mikrotik/mikrotik.module';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UsersModule,
    MikrotikModule,
  ],
  providers: [SessionCleanupService],
  exports: [SessionCleanupService],
})
export class SessionCleanupModule {}
