import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FeedbackImportController } from './feedback-import.controller';
import { FeedbackImportService } from './feedback-import.service';

import { AiModule } from '../ai/ai.module';

import { Period, PeriodSchema } from '../../academic/periods/schemas/period.schema';
import { Career, CareerSchema } from '../../academic/careers/schemas/career.schema';
import { Group, GroupSchema } from '../../academic/groups/schemas/group.schema';
import { Subject, SubjectSchema } from '../../academic/subjects/schemas/subject.schema';
import { Teacher, TeacherSchema } from '../../academic/teachers/schemas/teacher.schema';
import { Student, StudentSchema } from '../../academic/students/schemas/student.schema';
import {
  ClassAssignment,
  ClassAssignmentSchema,
} from '../../academic/class-assignments/schemas/class-assignment.schema';

import {
  TeacherEvaluation,
  TeacherEvaluationSchema,
} from '../evaluations/schemas/teacher-evaluation.schema';

import {
  TeacherComplaint,
  TeacherComplaintSchema,
} from '../complaints/schemas/teacher-complaint.schema';

@Module({
  imports: [
    AiModule,
    MongooseModule.forFeature([
      { name: Period.name, schema: PeriodSchema },
      { name: Career.name, schema: CareerSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Teacher.name, schema: TeacherSchema },
      { name: Student.name, schema: StudentSchema },
      { name: ClassAssignment.name, schema: ClassAssignmentSchema },

      { name: TeacherEvaluation.name, schema: TeacherEvaluationSchema },
      { name: TeacherComplaint.name, schema: TeacherComplaintSchema },
    ]),
  ],
  controllers: [FeedbackImportController],
  providers: [FeedbackImportService],
})
export class FeedbackImportModule {}
