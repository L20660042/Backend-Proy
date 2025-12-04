import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Group } from '../../groups/schemas/group.schema';

export type AlertDocument = Alert & Document;

export enum AlertType {
  RIESGO_ACADEMICO = 'riesgo_academico',
  QUEJA = 'queja',
  COMPORTAMIENTO = 'comportamiento',
  OTRO = 'otro',
}

@Schema({ timestamps: true })
export class Alert {
  @Prop({ type: Types.ObjectId, ref: User.name })
  student: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  teacher: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Group.name })
  group: Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({ enum: AlertType, required: true })
  type: AlertType;

  @Prop({ default: 0 })
  riskLevel: number;

  @Prop({ default: false })
  resolved: boolean;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);
