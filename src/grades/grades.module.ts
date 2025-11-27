import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { Grade, GradeSchema } from './grade.schema';
import { User, UserSchema } from '../users/user.schema';
import { Subject, SubjectSchema } from '../subjects/subject.schema';
import { Group, GroupSchema } from '../groups/group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Grade.name, schema: GradeSchema },
      { name: User.name, schema: UserSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Group.name, schema: GroupSchema }
    ]),
  ],
  providers: [GradesService],
  controllers: [GradesController],
  exports: [GradesService]
})
export class GradesModule {}