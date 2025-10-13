import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class User extends Document {
  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true })
  apellido: string;

  @Prop({ required: true, unique: true })
  correo: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  userType: string;

  // Código de verificación temporal
  @Prop()
  verificationCode?: string;

  // Fecha de expiración del código
  @Prop()
  verificationCodeExpires?: Date;

  // Flag para saber si el correo ya fue verificado
  @Prop({ default: false })
  isVerified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
