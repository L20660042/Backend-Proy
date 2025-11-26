import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService]
})
export class AnalyticsModule {}