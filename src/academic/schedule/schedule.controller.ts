import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { GetGroupScheduleDto, GetStudentScheduleDto, GetTeacherScheduleDto } from './dto/get-schedule.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

@Controller('academic/schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  // GET /academic/schedule/teacher?periodId=...&teacherId=...
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get('teacher')
  teacher(@Query() q: GetTeacherScheduleDto) {
    return this.service.getTeacherSchedule(q.periodId, q.teacherId);
  }

  // GET /academic/schedule/group?periodId=...&groupId=...
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get('group')
  group(@Query() q: GetGroupScheduleDto) {
    return this.service.getGroupSchedule(q.periodId, q.groupId);
  }

  // GET /academic/schedule/student?periodId=...&studentId=...
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get('student')
  student(@Query() q: GetStudentScheduleDto) {
    return this.service.getStudentSchedule(q.periodId, q.studentId);
  }
  @Get('me')
  me(@Req() req: any, @Query('periodId') periodId: string) {
  return this.service.getMySchedule(req.user, periodId);
}
}
