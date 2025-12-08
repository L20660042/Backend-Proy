import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Subject } from '../../subjects/schemas/subject.schema';
import { User } from '../../users/schemas/user.schema';
import { Career } from '../../careers/schemas/career.schema';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: Career.name })
  career?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Subject.name, required: true })
  subject: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  teacher?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: User.name }] })
  students?: Types.ObjectId[];

  @Prop()
  schedule?: string;

  @Prop({ default: 30 })
  capacity: number;

  @Prop({ default: true })
  active: boolean;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

GroupSchema.index({ name: 1 });
GroupSchema.index({ code: 1 }, { unique: true });