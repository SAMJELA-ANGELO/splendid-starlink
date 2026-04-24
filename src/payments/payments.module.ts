import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsGateway } from './payments.gateway';
import { PaymentLimitGuard } from './payment-limit.guard';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { UsersModule } from '../users/users.module';
import { PlansModule } from '../plans/plans.module';
import { MikrotikModule } from '../mikrotik/mikrotik.module';
import { ActivitiesModule } from '../activities/activities.module';
import { BlacklistModule } from '../blacklist/blacklist.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    UsersModule,
    PlansModule,
    MikrotikModule,
    ActivitiesModule,
    BlacklistModule,
  ],
  providers: [PaymentsService, PaymentsGateway, PaymentLimitGuard],
  controllers: [PaymentsController],
  exports: [PaymentsService, PaymentsGateway],
})
export class PaymentsModule {}
