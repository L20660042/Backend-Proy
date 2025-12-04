import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { ExcelController } from './excel.controller';
import { UsersModule } from '../users/users.module';
import { CareersModule } from '../careers/careers.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { GroupsModule } from '../groups/groups.module';
import { TutoriaModule } from '../tutoria/tutoria.module';
import { CapacitacionModule } from '../capacitacion/capacitacion.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    UsersModule,
    CareersModule,
    SubjectsModule,
    GroupsModule,
    TutoriaModule,
    CapacitacionModule,
    AlertsModule,
  ],
  controllers: [ExcelController],
  providers: [ExcelService],
})
export class ExcelModule {}
