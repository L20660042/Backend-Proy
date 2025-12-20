import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClassAssignmentDocument = HydratedDocument<ClassAssignment>;

@Schema({ timestamps: true })
export class ClassAssignment {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Career', required: true, index: true })
  careerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  groupId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true, index: true })
  subjectId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true, index: true })
  teacherId: Types.ObjectId;

  @Prop({ type: String, default: 'active' })
  status: 'active' | 'inactive';
}

export const ClassAssignmentSchema = SchemaFactory.createForClass(ClassAssignment);

// Regla: un grupo no debe tener la misma materia duplicada en el mismo periodo
ClassAssignmentSchema.index({ periodId: 1, groupId: 1, subjectId: 1 }, { unique: true });

// Consultas frecuentes
ClassAssignmentSchema.index({ periodId: 1, teacherId: 1, status: 1 });
ClassAssignmentSchema.index({ periodId: 1, careerId: 1, groupId: 1 });
