import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types, SchemaTypes } from 'mongoose';

export type TeacherEvaluationDocument = HydratedDocument<TeacherEvaluation>;

@Schema({ timestamps: true })
export class TeacherEvaluation {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ClassAssignment', required: true, index: true })
  classAssignmentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId: Types.ObjectId;

  // Denormalizados para resumen por docente/grupo/materia:
  @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true, index: true })
  teacherId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  groupId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true, index: true })
  subjectId: Types.ObjectId;

  @Prop({ type: Map, of: Number, default: {} })
  ratings: Record<string, number>;

  @Prop({ type: String, default: '', trim: true })
  comment: string;

  @Prop({ type: String, enum: ['submitted'], default: 'submitted', index: true })
  status: 'submitted';

  @Prop({ type: SchemaTypes.Mixed, default: null })
  analysis?: any; // AiAnalysisResult
}

export const TeacherEvaluationSchema = SchemaFactory.createForClass(TeacherEvaluation);

// Un alumno solo puede evaluar una carga una vez por periodo
TeacherEvaluationSchema.index({ periodId: 1, classAssignmentId: 1, studentId: 1 }, { unique: true });

// Consultas frecuentes
TeacherEvaluationSchema.index({ periodId: 1, teacherId: 1 });
TeacherEvaluationSchema.index({ periodId: 1, groupId: 1 });
TeacherEvaluationSchema.index({ periodId: 1, subjectId: 1 });
