import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassAssignment, ClassAssignmentSchema } from './schemas/class-assignment.schema';
import { ClassAssignmentsController } from './class-assignments.controller';
import { ClassAssignmentsService } from './class-assignments.service';
import { CourseEnrollment, CourseEnrollmentSchema } from '../course-enrollments/schemas/course-enrollment.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: ClassAssignment.name, schema: ClassAssignmentSchema },
    { name: CourseEnrollment.name, schema: CourseEnrollmentSchema },
  ])],
  controllers: [ClassAssignmentsController],
  providers: [ClassAssignmentsService],
  exports: [ClassAssignmentsService],
})
export class ClassAssignmentsModule {}
