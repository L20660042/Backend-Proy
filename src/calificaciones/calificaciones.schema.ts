import { Schema, Document } from 'mongoose';

export const CalificacionSchema = new Schema({
  estudianteId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Relacionado con el ID del estudiante
  materia: { type: String, required: true },
  calificacion: { type: Number, required: true },
  fecha: { type: Date, default: Date.now },
  evaluacion: { type: String, required: true },
});

export interface Calificacion extends Document {
  estudianteId: string;
  materia: string;
  calificacion: number;
  fecha: Date;
  evaluacion: string;
}
