import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ImportController } from './import.controller';
import { ImportService } from './import.service';

import { Period, PeriodSchema } from '../periods/schemas/period.schema';
import { Career, CareerSchema } from '../careers/schemas/career.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { ClassAssignment, ClassAssignmentSchema } from '../class-assignments/schemas/class-assignment.schema';
import { ScheduleBlock, ScheduleBlockSchema } from '../schedule-blocks/schemas/schedule-block.schema';

import { StudentsModule } from '../students/students.module';
import { ClassAssignmentsModule } from '../class-assignments/class-assignments.module';
import { ScheduleBlocksModule } from '../schedule-blocks/schedule-blocks.module';

@Module({
  imports: [
    // modelos para resolver IDs por “códigos” (periodName, careerCode, subjectCode, etc.)
    MongooseModule.forFeature([
      { name: Period.name, schema: PeriodSchema },
      { name: Career.name, schema: CareerSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Teacher.name, schema: TeacherSchema },
      { name: Student.name, schema: StudentSchema },
      { name: ClassAssignment.name, schema: ClassAssignmentSchema },
      { name: ScheduleBlock.name, schema: ScheduleBlockSchema },
    ]),
    StudentsModule,
    ClassAssignmentsModule,
    ScheduleBlocksModule,
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
