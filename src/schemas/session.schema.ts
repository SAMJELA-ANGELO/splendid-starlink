import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema()
export class Session {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ type: Date, required: true })
  startTime: Date;

  @Prop({ type: Date, default: undefined })
  endTime?: Date;

  @Prop({ type: Number, default: 0 })
  dataUsed: number;

  @Prop({ required: true, default: false })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  remainingTime: number;

  @Prop({ type: String, default: null })
  macAddress?: string;

  @Prop({ type: String, default: null })
  routerIdentity?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
