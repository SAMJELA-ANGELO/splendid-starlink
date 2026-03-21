import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { UsersModule } from '../users/users.module';
import { PlansModule } from '../plans/plans.module';
import { MikrotikModule } from '../mikrotik/mikrotik.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    UsersModule,
    PlansModule,
    MikrotikModule,
    AuthModule,
  ],
  providers: [PaymentsService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
