import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ timestamps: true })
export class Student {
  @Prop({ required: true, unique: true, trim: true })
  controlNumber: string; // No. control (ej: "20660042")

  @Prop({ required: true, trim: true })
  name: string; // Nombre completo

  @Prop({ type: Types.ObjectId, ref: 'Career', required: true, index: true })
  careerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', default: null, index: true })
  groupId?: Types.ObjectId | null;

  @Prop({ type: String, default: 'active' })
  status: 'active' | 'inactive' | 'suspended';
}

export const StudentSchema = SchemaFactory.createForClass(Student);

StudentSchema.index({ controlNumber: 1 }, { unique: true });
StudentSchema.index({ careerId: 1, status: 1 });
StudentSchema.index({ groupId: 1, status: 1 });
