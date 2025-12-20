import { Controller, Get, Query } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { GetGroupScheduleDto, GetStudentScheduleDto, GetTeacherScheduleDto } from './dto/get-schedule.dto';

@Controller('academic/schedule')
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  // GET /academic/schedule/teacher?periodId=...&teacherId=...
  @Get('teacher')
  teacher(@Query() q: GetTeacherScheduleDto) {
    return this.service.getTeacherSchedule(q.periodId, q.teacherId);
  }

  // GET /academic/schedule/group?periodId=...&groupId=...
  @Get('group')
  group(@Query() q: GetGroupScheduleDto) {
    return this.service.getGroupSchedule(q.periodId, q.groupId);
  }

  // GET /academic/schedule/student?periodId=...&studentId=...
  @Get('student')
  student(@Query() q: GetStudentScheduleDto) {
    return this.service.getStudentSchedule(q.periodId, q.studentId);
  }
}
