import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type JoinRequest = {
  teacherId: Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
};

@Schema()
export class Institution extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  address?: string;

  @Prop()
  phone?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  academicStaff: Types.ObjectId[];

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  teachers: Types.ObjectId[];

  @Prop([{
    teacherId: { type: Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  }])
  joinRequests: JoinRequest[];
}

export const InstitutionSchema = SchemaFactory.createForClass(Institution);