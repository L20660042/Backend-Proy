import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CareerDocument = HydratedDocument<Career>;

@Schema({ timestamps: true })
export class Career {
  @Prop({ required: true, trim: true })
  name: string; // Ej: "Ingeniería en Sistemas Computacionales"

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string; // Ej: "ISC"

  @Prop({ type: String, default: null })
  divisionId?: string | null;

  @Prop({ type: String, default: 'active' })
  status: 'active' | 'inactive';
}

export const CareerSchema = SchemaFactory.createForClass(Career);
CareerSchema.index({ code: 1 }, { unique: true });
CareerSchema.index({ status: 1 });
