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
}

export const UserSchema = SchemaFactory.createForClass(User);
