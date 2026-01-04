import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { PeriodsModule } from './academic/periods/periods.module';
import { CareersModule } from './academic/careers/careers.module';
import { SubjectsModule } from './academic/subjects/subjects.module';
import { GroupsModule } from './academic/groups/groups.module';
import { TeachersModule } from './academic/teachers/teachers.module';
import { StudentsModule } from './academic/students/students.module';
import { EnrollmentsModule } from './academic/enrollments/enrollments.module';
import { ClassAssignmentsModule } from './academic/class-assignments/class-assignments.module';
import { ScheduleBlocksModule } from './academic/schedule-blocks/schedule-blocks.module';
import { ScheduleModule } from './academic/schedule/schedule.module';
import { CourseEnrollmentsModule } from './academic/course-enrollments/course-enrollments.module';
import { ImportModule } from './academic/import/import.module';
import { FeedbackModule } from './feedback/feedback.module';
import { ActivitiesModule } from './academic/activities/activities.module';
import { ActivityEnrollmentsModule } from './academic/activity-enrollments/activity-enrollments.module';
import { GradesAnalyticsModule } from './academic/grades-analytics/grades-analytics.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    ActivitiesModule,
    ActivityEnrollmentsModule,
    FeedbackModule,
    CourseEnrollmentsModule,
    SeedModule,
    PeriodsModule,
    CareersModule,
    ImportModule,
    SubjectsModule,
    GroupsModule,
    TeachersModule,
    StudentsModule,
    EnrollmentsModule,
    ClassAssignmentsModule,
    ScheduleBlocksModule,
    ScheduleModule,
    GradesAnalyticsModule,
  ],
})
export class AppModule {}
