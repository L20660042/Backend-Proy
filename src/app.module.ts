import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CareersModule } from './careers/careers.module';
import { SubjectsModule } from './subjects/subjects.module';
import { GroupsModule } from './groups/groups.module';
import { TutoriaModule } from './tutoria/tutoria.module';
import { CapacitacionModule } from './capacitacion/capacitacion.module';
import { AlertsModule } from './alerts/alerts.module';
import { ReportsModule } from './reports/reports.module';
import { FiltersModule } from './filters/filters.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      'mongodb+srv://luistoarzola_db_user:oPySQBXAF7EodFNX@proyecto.gdcgnsp.mongodb.net/',
      { dbName: 'proyecto1', autoIndex: true },
    ),
    UsersModule,
    AuthModule,
    CareersModule,
    SubjectsModule,
    GroupsModule,
    TutoriaModule,
    CapacitacionModule,
    AlertsModule,
    ReportsModule,
    FiltersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
