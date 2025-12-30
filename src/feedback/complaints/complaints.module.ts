import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';
import { TeacherComplaint, TeacherComplaintSchema } from './schemas/teacher-complaint.schema';
import { AiModule } from '../ai/ai.module';

import { ClassAssignment, ClassAssignmentSchema } from '../../academic/class-assignments/schemas/class-assignment.schema';

@Module({
  imports: [
    AiModule,
    MongooseModule.forFeature([
      { name: TeacherComplaint.name, schema: TeacherComplaintSchema },
      { name: ClassAssignment.name, schema: ClassAssignmentSchema },
    ]),
  ],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
