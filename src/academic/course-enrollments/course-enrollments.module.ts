import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassAssignmentsModule } from '../class-assignments/class-assignments.module';
import { CourseEnrollmentsController } from './course-enrollments.controller';
import { CourseEnrollmentsService } from './course-enrollments.service';
import { CourseEnrollment, CourseEnrollmentSchema } from './schemas/course-enrollment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CourseEnrollment.name, schema: CourseEnrollmentSchema }]),
    ClassAssignmentsModule,
  ],
  controllers: [CourseEnrollmentsController],
  providers: [CourseEnrollmentsService],
  exports: [CourseEnrollmentsService],
})
export class CourseEnrollmentsModule {}
