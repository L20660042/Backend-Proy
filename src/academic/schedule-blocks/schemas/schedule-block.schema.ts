import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScheduleBlockDocument = HydratedDocument<ScheduleBlock>;

export type DeliveryMode = 'presencial' | 'semipresencial' | 'asincrono';

@Schema({ timestamps: true })
export class ScheduleBlock {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: String, required: true })
  type: 'class' | 'extracurricular';

  // ✅ NUEVO: modalidad del bloque
  // presencial -> NO permite traslape por grupo
  // semipresencial -> permite traslape por grupo (pero sigue validando docente/aula)
  // asincrono -> no debería “consumir” horario (relaja choques, normalmente room=null)
  @Prop({ type: String, default: 'presencial', index: true })
  deliveryMode: DeliveryMode;

  // 1=Lunes ... 7=Domingo
  @Prop({ required: true, min: 1, max: 7, index: true })
  dayOfWeek: number;

  // "HH:MM"
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

  // Para extraescolares
  @Prop({ type: Types.ObjectId, ref: 'Activity', default: null, index: true })
  activityId?: Types.ObjectId | null;
}

export const ScheduleBlockSchema = SchemaFactory.createForClass(ScheduleBlock);

ScheduleBlockSchema.index({ periodId: 1, dayOfWeek: 1 });
ScheduleBlockSchema.index({ periodId: 1, teacherId: 1, dayOfWeek: 1 });
ScheduleBlockSchema.index({ periodId: 1, groupId: 1, dayOfWeek: 1 });
ScheduleBlockSchema.index({ periodId: 1, room: 1, dayOfWeek: 1 });
ScheduleBlockSchema.index({ periodId: 1, deliveryMode: 1 });
