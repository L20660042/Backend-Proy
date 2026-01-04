import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TeacherDocument = HydratedDocument<Teacher>;

@Schema({ timestamps: true })
export class Teacher {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  employeeNumber: string;

  @Prop({ type: String, default: null })
  divisionId?: string | null;

  @Prop({ type: String, default: 'active' })
  status: 'active' | 'inactive' | 'suspended';
}

export const TeacherSchema = SchemaFactory.createForClass(Teacher);

TeacherSchema.index({ status: 1 });
TeacherSchema.index({ divisionId: 1 });
