import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { ScheduleBlocksModule } from '../schedule-blocks/schedule-blocks.module';
import { Period, PeriodSchema } from '../periods/schemas/period.schema';
import { Career, CareerSchema } from '../careers/schemas/career.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { ClassAssignment, ClassAssignmentSchema } from '../class-assignments/schemas/class-assignment.schema';
import { ScheduleBlock, ScheduleBlockSchema } from '../schedule-blocks/schemas/schedule-block.schema';
import { StudentsModule } from '../students/students.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ClassAssignmentsModule } from '../class-assignments/class-assignments.module';

import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import { ActivityEnrollment, ActivityEnrollmentSchema } from '../activity-enrollments/schemas/activity-enrollment.schema';
import { ActivityEnrollmentsModule } from '../activity-enrollments/activity-enrollments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Period.name, schema: PeriodSchema },
      { name: Career.name, schema: CareerSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Teacher.name, schema: TeacherSchema },
      { name: Student.name, schema: StudentSchema },
      { name: ClassAssignment.name, schema: ClassAssignmentSchema },
      { name: ScheduleBlock.name, schema: ScheduleBlockSchema },

      // NUEVO
      { name: Activity.name, schema: ActivitySchema },
      { name: ActivityEnrollment.name, schema: ActivityEnrollmentSchema },
    ]),
    EnrollmentsModule,
    ClassAssignmentsModule,
    ScheduleBlocksModule,
    StudentsModule,
    ActivityEnrollmentsModule,
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
