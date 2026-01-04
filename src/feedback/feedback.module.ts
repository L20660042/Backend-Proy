import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FeedbackImportModule } from './import/feedback-import.module';

@Module({
  imports: [AiModule, EvaluationsModule, ComplaintsModule, AnalyticsModule, FeedbackImportModule,],
})
export class FeedbackModule {}
