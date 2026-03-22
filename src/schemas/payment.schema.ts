import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema()
export class Payment {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  planId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({
    type: String,
    enum: ['created', 'pending', 'SUCCESSFUL', 'FAILED', 'EXPIRED'],
    default: 'created',
  })
  status: string;

  @Prop()
  fapshiTransactionId?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop()
  externalId?: string;

  @Prop({ type: Object })
  fapshiResponse: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop()
  purchasedBy?: string; // Track who purchased this (for buy-for-others feature)
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
