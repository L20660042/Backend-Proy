import { Schema, Document } from 'mongoose';

export const UserSchema = new Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { type: String, required: true },
});

export interface User extends Document {
  nombre: string;
  apellido: string;
  correo: string;
  password: string;
  userType: string;
}
