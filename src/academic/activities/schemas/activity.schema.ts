import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivityDocument = Activity & Document;

@Schema({ timestamps: true })
export class Activity {
  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  // Ejemplos: "deportiva", "cultural", "academica", "club", "taller", "otro"
  @Prop({ type: String, required: true, trim: true, index: true })
  type: string;

  // Responsable textual (MVP). Si luego lo quieres enlazar a Teacher, se cambia a teacherId.
  @Prop({ type: String, default: null, trim: true })
  responsibleName?: string | null;

  @Prop({ type: Number, default: null })
  capacity?: number | null;

  @Prop({ type: String, default: 'active', enum: ['active', 'inactive'], index: true })
  status: 'active' | 'inactive';
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

ActivitySchema.index({ periodId: 1, name: 1 });
