import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class User extends Document {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ 
    required: true, 
    enum: [
      'administrador-general',
      'jefe-departamento', 
      'docente',
      'tutor',
      'coordinador-tutorias',
      'control-escolar',
      'subdireccion-academica'
    ] 
  })
  userType: string;

  @Prop({ type: Types.ObjectId, ref: 'Institution' })
  institution?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
export type UserDocument = User & Document;