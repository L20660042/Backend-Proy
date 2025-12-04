import * as bcrypt from 'bcryptjs';

/** Encriptar contraseña */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/** Comparar contraseña */
export const comparePassword = async (password: string, hashed: string): Promise<boolean> => {
  return bcrypt.compare(password, hashed);
};

/** Validar si un string es un ObjectId válido */
import { Types } from 'mongoose';
export const isValidObjectId = (id: string) => {
  return Types.ObjectId.isValid(id);
};

/** Función para eliminar duplicados en arrays de ObjectId */
export const uniqueObjectIds = (ids: (string | Types.ObjectId)[]): Types.ObjectId[] => {
  const unique = Array.from(new Set(ids.map(id => id.toString())));
  return unique.map(id => new Types.ObjectId(id));
};
