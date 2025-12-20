import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GroupDocument = HydratedDocument<Group>;

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true, trim: true })
  name: string; // Ej: "3A"

  @Prop({ type: Types.ObjectId, ref: 'Career', required: true, index: true })
  careerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Period', required: true, index: true })
  periodId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  semester: number; // Ej: 1..12
}

export const GroupSchema = SchemaFactory.createForClass(Group);

// Unicidad: mismo periodo + misma carrera + mismo nombre de grupo
GroupSchema.index({ periodId: 1, careerId: 1, name: 1 }, { unique: true });

// Consultas frecuentes
GroupSchema.index({ periodId: 1, careerId: 1, semester: 1 });
