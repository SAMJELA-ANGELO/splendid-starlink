import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { Plan, PlanSchema } from '../schemas/plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Plan.name, schema: PlanSchema },
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
