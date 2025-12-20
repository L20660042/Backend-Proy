import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EnrollmentDocument = HydratedDocument<Enrollment>;

@Schema({ timestamps: true })
export class Enrollment {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  groupId: Types.ObjectId;

  @Prop({ type: String, default: 'active' })
  status: 'active' | 'dropped' | 'completed';
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

// Regla: un alumno solo puede estar inscrito a un grupo por periodo
EnrollmentSchema.index({ periodId: 1, studentId: 1 }, { unique: true });

// Consultas comunes
EnrollmentSchema.index({ periodId: 1, groupId: 1, status: 1 });
