import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PeriodDocument = HydratedDocument<Period>;

@Schema({ timestamps: true })
export class Period {
  @Prop({ required: true, trim: true })
  name: string; // Ej: "Ene-Jun 2026"

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: false })
  isActive: boolean;
}

export const PeriodSchema = SchemaFactory.createForClass(Period);
PeriodSchema.index({ name: 1 }, { unique: true });
