import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type CapacitacionDocument = Capacitacion & Document;

@Schema({ timestamps: true })
export class Capacitacion {
  @Prop({ required: true })
  title: string; // nombre del curso/taller/diplomado

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  teacher: Types.ObjectId; // docente vinculado

  @Prop({ required: true })
  date: Date;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: [] })
  evidence: string[]; // URLs o paths de archivos subidos

  @Prop({ default: '' })
  observations: string; // observaciones o resultados
}

export const CapacitacionSchema = SchemaFactory.createForClass(Capacitacion);
