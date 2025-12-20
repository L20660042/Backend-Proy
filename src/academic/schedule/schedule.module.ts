import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ScheduleBlocksModule } from '../schedule-blocks/schedule-blocks.module';

@Module({
  imports: [EnrollmentsModule, ScheduleBlocksModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
