import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PlansModule } from './plans/plans.module';
import { PaymentsModule } from './payments/payments.module';
import { MikrotikModule } from './mikrotik/mikrotik.module';
import { SessionsModule } from './sessions/sessions.module';
import { AdminSeederService } from './auth/admin-seeder.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URL'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    PlansModule,
    PaymentsModule,
    MikrotikModule,
    SessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AdminSeederService],
})
export class AppModule {}
