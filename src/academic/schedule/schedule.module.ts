import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { ScheduleBlocksModule } from '../schedule-blocks/schedule-blocks.module';
import { CourseEnrollmentsModule } from '../course-enrollments/course-enrollments.module';

@Module({
  imports: [CourseEnrollmentsModule, ScheduleBlocksModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
