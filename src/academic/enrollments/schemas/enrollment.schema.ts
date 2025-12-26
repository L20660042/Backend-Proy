import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EnrollmentDocument = Enrollment & Document;

@Schema({ timestamps: true })
export class Enrollment {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  groupId: Types.ObjectId;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active', index: true })
  status: 'active' | 'inactive';
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

// Regla MVP: 1 inscripción por alumno por periodo
EnrollmentSchema.index({ periodId: 1, studentId: 1 }, { unique: true });
