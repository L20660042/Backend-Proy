import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

import { TeacherEvaluation, TeacherEvaluationSchema } from '../evaluations/schemas/teacher-evaluation.schema';
import { TeacherComplaint, TeacherComplaintSchema } from '../complaints/schemas/teacher-complaint.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TeacherEvaluation.name, schema: TeacherEvaluationSchema },
      { name: TeacherComplaint.name, schema: TeacherComplaintSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
