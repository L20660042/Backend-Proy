import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Tutoria, TutoriaSchema } from '../tutoria/schemas/tutoria.schema';
import { Capacitacion, CapacitacionSchema } from '../capacitacion/schemas/capacitacion.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Career, CareerSchema } from '../careers/schemas/career.schema';
import { Report, ReportSchema } from './schemas/report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tutoria.name, schema: TutoriaSchema },
      { name: Capacitacion.name, schema: CapacitacionSchema },
      { name: User.name, schema: UserSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Career.name, schema: CareerSchema },
      { name: Report.name, schema: ReportSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}