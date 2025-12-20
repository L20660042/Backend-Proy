import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ScheduleBlocksService } from './schedule-blocks.service';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto';
import { UpdateScheduleBlockDto } from './dto/update-schedule-block.dto';

@Controller('academic/schedule-blocks')
export class ScheduleBlocksController {
  constructor(private readonly service: ScheduleBlocksService) {}

  @Post()
  create(@Body() dto: CreateScheduleBlockDto) {
    return this.service.create(dto);
  }

  // GET /academic/schedule-blocks?periodId=...&groupId=...&teacherId=...&dayOfWeek=1
  @Get()
  findAll(
    @Query('periodId') periodId?: string,
    @Query('groupId') groupId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('dayOfWeek') dayOfWeek?: string,
  ) {
    return this.service.findAll({ periodId, groupId, teacherId, dayOfWeek });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateScheduleBlockDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
