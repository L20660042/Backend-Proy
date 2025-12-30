import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CourseEnrollmentsController } from './course-enrollments.controller';
import { CourseEnrollmentsService } from './course-enrollments.service';
import { CourseEnrollment, CourseEnrollmentSchema } from './schemas/course-enrollment.schema';

import { ClassAssignmentsModule } from '../class-assignments/class-assignments.module';
import { ScheduleBlocksModule } from '../schedule-blocks/schedule-blocks.module';
import { StudentsModule } from '../students/students.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CourseEnrollment.name, schema: CourseEnrollmentSchema }]),
    ClassAssignmentsModule,
    ScheduleBlocksModule,
    StudentsModule,
    forwardRef(() => EnrollmentsModule),
  ],
  controllers: [CourseEnrollmentsController],
  providers: [CourseEnrollmentsService],
  exports: [CourseEnrollmentsService],
})
export class CourseEnrollmentsModule {}
