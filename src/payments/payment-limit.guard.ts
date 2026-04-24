import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';

@Injectable()
export class PaymentLimitGuard implements CanActivate {
  private logger = new Logger('PaymentLimitGuard');

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { macAddress, phone, userIp } = request.body;

    // Check for existing pending transactions
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const existingPending = await this.paymentModel.findOne({
      status: 'pending',
      createdAt: { $gte: tenMinutesAgo },
      $or: [
        { macAddress: macAddress },
        { phone: phone }
      ].filter(condition => condition.macAddress || condition.phone) // Only include non-null conditions
    });

    if (existingPending) {
      this.logger.warn(`Transaction lock triggered for MAC: ${macAddress}, Phone: ${phone}`);
      throw new Error('Please complete or cancel your existing payment attempt before starting a new one.');
    }

    return true;
  }
}