import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BlacklistDocument = Blacklist & Document;

@Schema()
export class Blacklist {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, enum: ['IP', 'PHONE', 'MAC'] })
  type: string;

  @Prop({ required: true, unique: true })
  value: string;

  @Prop()
  reason?: string;

  @Prop()
  expiresAt?: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const BlacklistSchema = SchemaFactory.createForClass(Blacklist);