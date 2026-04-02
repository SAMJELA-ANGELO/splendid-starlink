import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ActivityDocument = Activity & Document;

@Schema()
export class Activity {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  action: string; // e.g., "payment_processed", "session_started", "plan_upgraded", etc.

  @Prop({ required: true })
  category: string; // e.g., "payment", "session", "connection", "account"

  @Prop({ type: Object, default: {} })
  details: Record<string, any>; // Additional metadata about the action

  @Prop({
    type: String,
    enum: ['success', 'failed', 'pending', 'warning'],
    default: 'success',
  })
  status: string;

  @Prop({ type: String, default: null })
  description?: string; // Human-readable description

  @Prop({ type: String, default: null })
  ipAddress?: string; // IP address of the user when action occurred

  @Prop({ type: String, default: null })
  userAgent?: string; // Browser/Device information

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;

  @Prop({ type: String, default: null })
  routerIdentity?: string; // Which router this activity occurred on

  @Prop({ type: String, default: null })
  sessionId?: string; // Associated session if applicable
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
