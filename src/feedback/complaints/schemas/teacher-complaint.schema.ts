import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types, SchemaTypes } from 'mongoose';

export type TeacherComplaintDocument = HydratedDocument<TeacherComplaint>;

export type ComplaintStatus = 'open' | 'in_review' | 'resolved' | 'rejected';

@Schema({ timestamps: true })
export class TeacherComplaint {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Teacher', default: null, index: true })
  teacherId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'ClassAssignment', default: null, index: true })
  classAssignmentId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Group', default: null, index: true })
  groupId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Subject', default: null, index: true })
  subjectId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: ['trato', 'impuntualidad', 'evaluacion_injusta', 'incumplimiento', 'acoso', 'otro'],
    required: true,
    index: true,
  })
  category: 'trato' | 'impuntualidad' | 'evaluacion_injusta' | 'incumplimiento' | 'acoso' | 'otro';

  @Prop({ type: String, required: true, trim: true })
  description: string;

  @Prop({ type: String, enum: ['open', 'in_review', 'resolved', 'rejected'], default: 'open', index: true })
  status: ComplaintStatus;

  @Prop({ type: String, default: '', trim: true })
  resolutionNote?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignedToUserId?: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  analysis?: any; // AiAnalysisResult
}

export const TeacherComplaintSchema = SchemaFactory.createForClass(TeacherComplaint);

TeacherComplaintSchema.index({ periodId: 1, teacherId: 1, status: 1 });
TeacherComplaintSchema.index({ periodId: 1, studentId: 1, status: 1 });
