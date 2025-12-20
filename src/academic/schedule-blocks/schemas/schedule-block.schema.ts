import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScheduleBlockDocument = HydratedDocument<ScheduleBlock>;

@Schema({ timestamps: true })
export class ScheduleBlock {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: String, required: true })
  type: 'class' | 'extracurricular';

  // 1=Lunes ... 7=Domingo (ajústalo si prefieres 0-6)
  @Prop({ required: true, min: 1, max: 7, index: true })
  dayOfWeek: number;

  // "HH:MM" 24h (ej: "07:00")
  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({ type: String, default: null, index: true })
  room?: string | null;

  // Para clases
  @Prop({ type: Types.ObjectId, ref: 'Group', default: null, index: true })
  groupId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Subject', default: null })
  subjectId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Teacher', default: null, index: true })
  teacherId?: Types.ObjectId | null;

  // Para extraescolares (más adelante)
  @Prop({ type: Types.ObjectId, ref: 'Activity', default: null, index: true })
  activityId?: Types.ObjectId | null;
}

export const ScheduleBlockSchema = SchemaFactory.createForClass(ScheduleBlock);

// Índices útiles
ScheduleBlockSchema.index({ periodId: 1, dayOfWeek: 1 });
ScheduleBlockSchema.index({ periodId: 1, teacherId: 1, dayOfWeek: 1 });
ScheduleBlockSchema.index({ periodId: 1, groupId: 1, dayOfWeek: 1 });
ScheduleBlockSchema.index({ periodId: 1, room: 1, dayOfWeek: 1 });
