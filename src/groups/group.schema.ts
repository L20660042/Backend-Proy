import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop()
  grade?: string; // Ej: "1°", "2°", "3°"

  @Prop()
  level?: string; // Ej: "Primaria", "Secundaria", "Bachillerato"

  @Prop()
  semester?: string; // Ej: "2024-1", "2024-2"

  @Prop()
  shift?: string; // Ej: "Matutino", "Vespertino", "Nocturno"

  @Prop()
  capacity?: number;

  @Prop({ type: Types.ObjectId, ref: 'Institution', required: true })
  institution: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  students: Types.ObjectId[];

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  teachers: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  tutor?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  headTeacher?: Types.ObjectId;

  @Prop([{ 
    subject: { type: Types.ObjectId, ref: 'Subject', required: true },
    teacher: { type: Types.ObjectId, ref: 'User', required: true },
    schedule: String
  }])
  assignedSubjects: {
    subject: Types.ObjectId;
    teacher: Types.ObjectId;
    schedule?: string;
  }[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop()
  updatedAt?: Date;
}

export const GroupSchema = SchemaFactory.createForClass(Group);