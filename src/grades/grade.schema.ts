import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GradeDocument = Grade & Document;

@Schema({ timestamps: true })
export class Grade {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  student: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true })
  subject: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true })
  group: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  teacher: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 100 })
  score: number;

  @Prop({ 
    required: true,
    enum: ['primero', 'segundo', 'tercero', 'extraordinario', 'final'],
    default: 'primero'
  })
  period: string;

  @Prop()
  comments?: string;

  @Prop({ type: Types.ObjectId, ref: 'Institution', required: true })
  institution: Types.ObjectId;

  @Prop({ default: Date.now })
  gradedAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastModifiedBy?: Types.ObjectId;

  @Prop()
  lastModifiedAt?: Date;
}

export const GradeSchema = SchemaFactory.createForClass(Grade);