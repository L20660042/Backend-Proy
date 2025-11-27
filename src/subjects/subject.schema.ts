import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubjectDocument = Subject & Document;

@Schema({ timestamps: true })
export class Subject {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  code: string;

  @Prop()
  description?: string;

  @Prop({ required: true, min: 1 })
  credits: number;

  @Prop()
  hoursPerWeek?: number;

  @Prop({ 
    type: String,
    enum: ['obligatoria', 'optativa', 'electiva'],
    default: 'obligatoria'
  })
  type: string;

  @Prop()
  area?: string; // Ej: "Matemáticas", "Ciencias", "Humanidades"

  @Prop({ type: Types.ObjectId, ref: 'Institution', required: true })
  institution: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTeacher?: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  availableTeachers?: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop()
  updatedAt?: Date;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);