import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  plainPassword: string; // For password recovery - SECURITY RISK

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  sessionExpiry: Date;

  @Prop({ default: false })
  mikrotikCreated: boolean;

  @Prop({
    type: [
      { plan: String, purchasedAt: Date, amount: Number, duration: Number },
    ],
    default: [],
  })
  purchasedBundles: {
    plan: string;
    purchasedAt: Date;
    amount: number;
    duration: number;
  }[];

  @Prop({ type: Date, default: null })
  notification30minSent?: Date;

  @Prop({ type: Date, default: null })
  notification10minSent?: Date;

  @Prop({ type: Date, default: null })
  notificationExpiredSent?: Date;

  @Prop({ type: String, default: null })
  macAddress?: string;

  @Prop({ type: String, default: null })
  ipAddress?: string;

  @Prop({ type: String, default: null })
  routerIdentity?: string;

  @Prop({ type: Date, default: Date.now })
  createdAt?: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User).set('timestamps', true);
