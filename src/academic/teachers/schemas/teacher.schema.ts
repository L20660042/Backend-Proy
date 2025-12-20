import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TeacherDocument = HydratedDocument<Teacher>;

@Schema({ timestamps: true })
export class Teacher {
  @Prop({ required: true, trim: true })
  name: string; // Nombre completo

  @Prop({ required: true, unique: true, trim: true })
  employeeNumber: string; // No. empleado / RFC corto / identificador interno

  @Prop({ type: String, default: null })
  divisionId?: string | null; // opcional

  @Prop({ type: String, default: 'active' })
  status: 'active' | 'inactive' | 'suspended';
}

export const TeacherSchema = SchemaFactory.createForClass(Teacher);

TeacherSchema.index({ employeeNumber: 1 }, { unique: true });
TeacherSchema.index({ status: 1 });
TeacherSchema.index({ divisionId: 1 });
