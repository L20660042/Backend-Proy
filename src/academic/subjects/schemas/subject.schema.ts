import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubjectDocument = HydratedDocument<Subject>;

@Schema({ timestamps: true })
export class Subject {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'Career', required: true, index: true })
  careerId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  semester: number;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);

SubjectSchema.index({ careerId: 1, semester: 1 });
SubjectSchema.index({ careerId: 1, name: 1 });
