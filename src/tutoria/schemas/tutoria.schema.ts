import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Group } from '../../groups/schemas/group.schema';

export type TutoriaDocument = Tutoria & Document;

@Schema({ timestamps: true })
export class Tutoria {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  tutor: Types.ObjectId; // docente o tutor

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  student: Types.ObjectId; // alumno

  @Prop({ type: Types.ObjectId, ref: Group.name, required: true })
  group: Types.ObjectId; // grupo vinculado

  @Prop({ required: true })
  date: Date;

  @Prop({ default: '' })
  topics: string; // temas tratados

  @Prop({ default: '' })
  agreements: string; // acuerdos tomados

  @Prop({ default: '' })
  observations: string; // observaciones

  @Prop({ default: false })
  riskDetected: boolean; // indica si hay riesgo académico

  @Prop({ default: [] })
  followUps: string[]; // canalizaciones o seguimiento adicional
}

export const TutoriaSchema = SchemaFactory.createForClass(Tutoria);
