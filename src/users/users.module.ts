import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User, UserSchema } from '../schemas/user.schema';
import { MikrotikModule } from '../mikrotik/mikrotik.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MikrotikModule,
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
