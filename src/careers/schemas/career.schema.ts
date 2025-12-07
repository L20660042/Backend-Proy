import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CareerDocument = Career & Document;

@Schema({ timestamps: true })
export class Career {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 8 })
  duration: number;

  @Prop({ default: true })
  active: boolean;
}

export const CareerSchema = SchemaFactory.createForClass(Career);