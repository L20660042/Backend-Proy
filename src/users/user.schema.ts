import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'users', timestamps: true })
export class User extends Document {
  @Prop({ required: true, trim: true }) firstName: string;
  @Prop({ required: true, trim: true }) lastName: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true }) password: string;
  @Prop({
    required: true,
    enum: ['subdirector-academico','jefes-academicos','tutores','docentes','coordinadores']
  }) userType: string;
}
export const UserSchema = SchemaFactory.createForClass(User);
