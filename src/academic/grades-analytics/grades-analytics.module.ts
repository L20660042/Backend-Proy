import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { GradesAnalyticsController } from './grades-analytics.controller';
import { GradesAnalyticsService } from './grades-analytics.service';

import { CourseEnrollment, CourseEnrollmentSchema } from '../course-enrollments/schemas/course-enrollment.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { Period, PeriodSchema } from '../periods/schemas/period.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseEnrollment.name, schema: CourseEnrollmentSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Teacher.name, schema: TeacherSchema },
      { name: Period.name, schema: PeriodSchema },
    ]),
  ],
  controllers: [GradesAnalyticsController],
  providers: [GradesAnalyticsService],
})
export class GradesAnalyticsModule {}
