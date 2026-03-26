import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { User, UserSchema } from '../schemas/user.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { NotificationsService } from './notifications.service';
import { SessionNotificationService } from './session-notification.service';
import { PaymentNotificationsService } from './payment-notifications.service';
import { PaymentStatusNotificationService } from './payment-status-notification.service';
import { NotificationsController } from './notifications.controller';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    PlansModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    SessionNotificationService,
    PaymentNotificationsService,
    PaymentStatusNotificationService,
  ],
  exports: [
    NotificationsService,
    SessionNotificationService,
    PaymentNotificationsService,
    PaymentStatusNotificationService,
  ],
})
export class NotificationsModule {}
