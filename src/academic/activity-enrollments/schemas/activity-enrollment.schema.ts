import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivityEnrollmentDocument = ActivityEnrollment & Document;

@Schema({ timestamps: true })
export class ActivityEnrollment {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Activity', required: true, index: true })
  activityId: Types.ObjectId;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active', index: true })
  status: 'active' | 'inactive';
}

export const ActivityEnrollmentSchema = SchemaFactory.createForClass(ActivityEnrollment);

// Regla MVP: no duplicar la misma actividad para el mismo alumno dentro del periodo
ActivityEnrollmentSchema.index({ periodId: 1, studentId: 1, activityId: 1 }, { unique: true });
