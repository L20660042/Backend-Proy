import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Period, PeriodSchema } from './schemas/period.schema';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Period.name, schema: PeriodSchema }])],
  controllers: [PeriodsController],
  providers: [PeriodsService],
  exports: [PeriodsService],
})
export class PeriodsModule {}
