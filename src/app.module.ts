import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PlansModule } from './plans/plans.module';
import { PaymentsModule } from './payments/payments.module';
import { MikrotikModule } from './mikrotik/mikrotik.module';
import { SessionsModule } from './sessions/sessions.module';
import { SessionCleanupModule } from './session-cleanup/session-cleanup.module';
import { HealthModule } from './health/health.module';
import { AdminSeederService } from './auth/admin-seeder.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        ttl: 60000, // 1 minute  
        limit: 10, // 10 authentication requests per minute
        name: 'auth-limit',
      },
      {
        ttl: 60000, // 1 minute
        limit: 5, // 5 payment requests per minute
        name: 'payment-limit',
      },
    ]),
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
    SessionCleanupModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService, AdminSeederService],
})
export class AppModule {}
