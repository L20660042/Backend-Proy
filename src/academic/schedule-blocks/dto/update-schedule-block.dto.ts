import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleBlockDto } from './create-schedule-block.dto';

export class UpdateScheduleBlockDto extends PartialType(CreateScheduleBlockDto) {}
