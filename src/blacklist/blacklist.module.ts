import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Blacklist, BlacklistSchema } from '../schemas/blacklist.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { BlacklistService } from './blacklist.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blacklist.name, schema: BlacklistSchema },
      { name: Payment.name, schema: PaymentSchema }
    ]),
  ],
  providers: [BlacklistService],
  exports: [BlacklistService],
})
export class BlacklistModule {}