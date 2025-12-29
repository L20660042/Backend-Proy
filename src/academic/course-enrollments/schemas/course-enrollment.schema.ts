import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseEnrollmentDocument = CourseEnrollment & Document;

@Schema({ timestamps: true })
export class CourseEnrollment {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId: Types.ObjectId;

  // Referencia principal (carga)
  @Prop({ type: Types.ObjectId, ref: 'ClassAssignment', required: true, index: true })
  classAssignmentId: Types.ObjectId;

  // Denormalizados para consultas rápidas (horario y listados)
  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  groupId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true })
  subjectId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true, index: true })
  teacherId: Types.ObjectId;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active', index: true })
  status: 'active' | 'inactive';

  @Prop({ type: Number, default: null, min: 0, max: 100 })
  finalGrade?: number | null;

}

export const CourseEnrollmentSchema = SchemaFactory.createForClass(CourseEnrollment);

// Regla MVP: no duplicar la misma carga para el mismo alumno dentro del periodo
CourseEnrollmentSchema.index(
  { periodId: 1, studentId: 1, classAssignmentId: 1 },
  { unique: true },
);
