import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TeacherEvaluation, TeacherEvaluationSchema } from './schemas/teacher-evaluation.schema';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { AiModule } from '../ai/ai.module';

// Para validar inscripción y denormalizar:
import { CourseEnrollment, CourseEnrollmentSchema } from '../../academic/course-enrollments/schemas/course-enrollment.schema';
import { ClassAssignment, ClassAssignmentSchema } from '../../academic/class-assignments/schemas/class-assignment.schema';

@Module({
  imports: [
    AiModule,
    MongooseModule.forFeature([
      { name: TeacherEvaluation.name, schema: TeacherEvaluationSchema },
      { name: CourseEnrollment.name, schema: CourseEnrollmentSchema },
      { name: ClassAssignment.name, schema: ClassAssignmentSchema },
    ]),
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
