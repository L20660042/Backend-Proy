import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Career } from '../../careers/schemas/career.schema';

export type SubjectDocument = Subject & Document;

@Schema({ timestamps: true })
export class Subject {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: Career.name, required: true })
  career: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  teacher?: Types.ObjectId;

  @Prop({ default: 4 })
  credits: number;

  @Prop({ default: 1 })
  semester: number;

  @Prop({ default: true })
  active: boolean;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);

SubjectSchema.index({ code: 1 });
SubjectSchema.index({ name: 1 });
SubjectSchema.index({ career: 1 });
SubjectSchema.index({ semester: 1 });