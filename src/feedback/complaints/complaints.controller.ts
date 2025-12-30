import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

import { ComplaintsService } from './complaints.service';
import { CreateTeacherComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';

@Controller('feedback/complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplaintsController {
  constructor(private readonly service: ComplaintsService) {}

  @Roles(Role.ALUMNO)
  @Post()
  create(@Req() req: any, @Body() dto: CreateTeacherComplaintDto) {
    return this.service.createAsStudent(req.user, dto);
  }

  @Roles(Role.ALUMNO)
  @Get('me')
  me(@Req() req: any, @Query('periodId') periodId: string) {
    return this.service.listMyComplaints(req.user, periodId);
  }

  @Roles(Role.DOCENTE)
  @Get('/teachers/me/summary')
  teacherSummary(@Req() req: any, @Query('periodId') periodId: string) {
    return this.service.teacherSummary(req.user, periodId);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.JEFE, Role.SUBDIRECCION, Role.DESARROLLO_ACADEMICO)
  @Get()
  adminList(@Query('periodId') periodId?: string, @Query('status') status?: string) {
    return this.service.adminList(periodId, status);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.JEFE, Role.SUBDIRECCION, Role.DESARROLLO_ACADEMICO)
  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateComplaintStatusDto) {
    return this.service.adminUpdateStatus(id, dto, req.user);
  }
}
