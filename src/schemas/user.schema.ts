import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  password: string;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
