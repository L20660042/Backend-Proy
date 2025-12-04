import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type SubjectDocument = Subject & Document;

@Schema({ timestamps: true })
export class Subject {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: User.name }) // docente asignado
  teacher?: Types.ObjectId;

  @Prop({ default: true })
  active: boolean;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);

SubjectSchema.index({ code: 1 });
SubjectSchema.index({ name: 1 });
