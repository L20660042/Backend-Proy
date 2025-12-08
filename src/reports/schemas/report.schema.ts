import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: ['tutoria', 'capacitacion', 'usuarios', 'grupos', 'materias', 'completo'] })
  type: string;

  @Prop({ default: 'json', enum: ['json', 'csv', 'excel', 'pdf'] })
  format: string;

  @Prop({ type: Object })
  filters: {
    userId?: string;
    studentId?: string;
    groupId?: string;
    subjectId?: string;
    careerId?: string;
    startDate?: Date;
    endDate?: Date;
  };

  @Prop()
  dataSize: number;

  @Prop({ default: 0 })
  recordCount: number;

  @Prop({ type: Object })
  stats: Record<string, any>;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  generatedBy: Types.ObjectId;

  @Prop({ default: 'completed', enum: ['pending', 'processing', 'completed', 'failed'] })
  status: string;

  @Prop({ default: 0 })
  downloadCount: number;

  @Prop()
  errorMessage?: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);