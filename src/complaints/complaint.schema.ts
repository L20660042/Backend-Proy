import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComplaintDocument = Complaint & Document;

@Schema({ timestamps: true })
export class Complaint {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  student: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  teacher: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject' })
  subject?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  group?: Types.ObjectId;

  @Prop({ 
    required: true, 
    enum: ['queja', 'evaluacion', 'sugerencia', 'reclamo'],
    default: 'evaluacion'
  })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ 
    type: String,
    enum: ['pedagogica', 'conducta', 'evaluacion', 'metodologia', 'otro'],
    default: 'pedagogica'
  })
  category?: string;

  @Prop({ 
    required: true, 
    enum: ['pendiente', 'en_revision', 'resuelta', 'rechazada'],
    default: 'pendiente'
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Institution', required: true })
  institution: Types.ObjectId;

  @Prop({ default: 1 })
  rating?: number; // 1-5 para evaluaciones

  @Prop({ default: false })
  isAnonymous: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;

  @Prop()
  resolution?: string;

  @Prop()
  resolvedAt?: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop()
  updatedAt?: Date;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);