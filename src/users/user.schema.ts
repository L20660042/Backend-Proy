import { Schema, Document } from 'mongoose';

// Interfaz para los datos del usuario
export interface User extends Document {
  email: string;
  password: string;
}

// Esquema de Mongoose para el modelo de usuario
export const UserSchema = new Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});
