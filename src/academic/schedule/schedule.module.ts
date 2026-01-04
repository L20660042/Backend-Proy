import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { ScheduleBlocksModule } from '../schedule-blocks/schedule-blocks.module';
import { CourseEnrollmentsModule } from '../course-enrollments/course-enrollments.module';
import { ActivityEnrollmentsModule } from '../activity-enrollments/activity-enrollments.module';

@Module({
  imports: [CourseEnrollmentsModule, ActivityEnrollmentsModule, ScheduleBlocksModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
