import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ActivityEnrollmentsController } from './activity-enrollments.controller';
import { ActivityEnrollmentsService } from './activity-enrollments.service';
import { ActivityEnrollment, ActivityEnrollmentSchema } from './schemas/activity-enrollment.schema';

import { ScheduleBlocksModule } from '../schedule-blocks/schedule-blocks.module';
import { CourseEnrollmentsModule } from '../course-enrollments/course-enrollments.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ActivityEnrollment.name, schema: ActivityEnrollmentSchema }]),
    ScheduleBlocksModule,
    CourseEnrollmentsModule,
  ],
  controllers: [ActivityEnrollmentsController],
  providers: [ActivityEnrollmentsService],
  exports: [ActivityEnrollmentsService],
})
export class ActivityEnrollmentsModule {}
