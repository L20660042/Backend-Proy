import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from '../../common/enums';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop()
  phone?: string;

  @Prop() // <-- QUITADO: required: true
  password?: string; // <-- HECHO OPCIONAL

  @Prop({
    enum: UserRole,
    default: UserRole.ESTUDIANTE,
  })
  role: UserRole;

  @Prop({ type: Types.ObjectId, ref: 'Career' })
  career?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Subject' }] })
  subjects?: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Group' }] })
  groups?: Types.ObjectId[];

  @Prop({ default: true })
  active: boolean;

  @Prop({ type: Object })
  meta?: any;

  // Campos adicionales para frontend
  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  institutionId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index para buscar por email rápidamente
UserSchema.index({ email: 1 });
