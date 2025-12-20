import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassAssignment, ClassAssignmentSchema } from './schemas/class-assignment.schema';
import { ClassAssignmentsController } from './class-assignments.controller';
import { ClassAssignmentsService } from './class-assignments.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ClassAssignment.name, schema: ClassAssignmentSchema }])],
  controllers: [ClassAssignmentsController],
  providers: [ClassAssignmentsService],
  exports: [ClassAssignmentsService],
})
export class ClassAssignmentsModule {}
