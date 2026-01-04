import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseEnrollmentDocument = CourseEnrollment & Document;

export type UnitGrades = {
  u1?: number;
  u2?: number;
  u3?: number;
  u4?: number;
  u5?: number;
};

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

  @Prop({
    type: {
      u1: { type: Number, min: 0, max: 100 },
      u2: { type: Number, min: 0, max: 100 },
      u3: { type: Number, min: 0, max: 100 },
      u4: { type: Number, min: 0, max: 100 },
      u5: { type: Number, min: 0, max: 100 },
    },
    default: {},
  })
  unitGrades: UnitGrades;


  @Prop({ type: Number, default: null, min: 0, max: 100 })
  finalGrade?: number | null;

  @Prop({ type: Types.ObjectId, ref: 'Teacher', required: false })
  gradedByTeacherId?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  gradedAt?: Date;
}

export const CourseEnrollmentSchema = SchemaFactory.createForClass(CourseEnrollment);

CourseEnrollmentSchema.index({ periodId: 1, studentId: 1, classAssignmentId: 1 }, { unique: true });
