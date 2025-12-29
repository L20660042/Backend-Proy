import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

import { CourseEnrollmentsService } from './course-enrollments.service';
import { CreateCourseEnrollmentDto } from './dto/create-course-enrollment.dto';
import { UpdateCourseEnrollmentDto } from './dto/update-course-enrollment.dto';
import { ClassAssignmentsService } from '../class-assignments/class-assignments.service';

@Controller('academic/course-enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseEnrollmentsController {
  constructor(
    private readonly service: CourseEnrollmentsService,
    private readonly classAssignments: ClassAssignmentsService,
  ) {}

  @Roles(Role.DOCENTE, Role.ALUMNO)
  @Get('me')
  async me(
    @Req() req: any,
    @Query('periodId') periodId?: string,
    @Query('classAssignmentId') classAssignmentId?: string,
    @Query('status') status?: string,
  ) {
    const roles: string[] = req.user?.roles ?? [];
    const linkedId = req.user?.linkedEntityId;

    if (!linkedId) throw new ForbiddenException('Usuario sin linkedEntityId');
    if (!periodId) throw new BadRequestException('periodId requerido');

    const s = status ?? 'active';

    const isTeacher = roles.includes(Role.DOCENTE);
    const isStudent = roles.includes(Role.ALUMNO);

    // Caso DOCENTE: requiere classAssignmentId y valida propiedad
    if (isTeacher) {
      if (!classAssignmentId) throw new BadRequestException('classAssignmentId requerido para docente');

      const ca = await this.classAssignments.findOne(classAssignmentId);
      const caTeacherId = String((ca as any).teacherId?._id ?? (ca as any).teacherId);
      const caPeriodId = String((ca as any).periodId?._id ?? (ca as any).periodId);

      if (caTeacherId !== String(linkedId)) {
        throw new ForbiddenException('No puedes consultar alumnos de una carga que no es tuya');
      }
      if (caPeriodId !== String(periodId)) {
        throw new BadRequestException('La carga (classAssignment) no pertenece al periodId indicado');
      }

      return this.service.list({
        periodId,
        classAssignmentId,
        status: s,
      });
    }

    // Caso ALUMNO: lista sus course-enrollments del periodo
    if (isStudent) {
      return this.service.list({
        periodId,
        studentId: String(linkedId),
        status: s,
      });
    }

    throw new ForbiddenException('Rol no autorizado');
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Post('bulk/by-group')
  bulkByGroup(@Body() body: { periodId: string; groupId: string; status?: 'active' | 'inactive' }) {
    return this.service.bulkEnrollByGroup({
      periodId: body.periodId,
      groupId: body.groupId,
      status: body.status ?? 'active',
    });
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get()
  list(
    @Query('periodId') periodId?: string,
    @Query('studentId') studentId?: string,
    @Query('classAssignmentId') classAssignmentId?: string,
    @Query('groupId') groupId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({
      periodId,
      studentId,
      classAssignmentId,
      groupId,
      subjectId,
      teacherId,
      status,
    });
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Post()
  create(@Body() dto: CreateCourseEnrollmentDto) {
    return this.service.create(dto);
  }

  @Roles(Role.DOCENTE, Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCourseEnrollmentDto) {
    const roles: string[] = req.user?.roles ?? [];

    const isAdmin =
      roles.includes(Role.SUPERADMIN) ||
      roles.includes(Role.ADMIN) ||
      roles.includes(Role.SERVICIOS_ESCOLARES);

    if (isAdmin) {
      return this.service.updateAsAdmin(id, dto);
    }

    // Docente
    const teacherId = req.user?.linkedEntityId;
    if (!teacherId) throw new ForbiddenException('Usuario sin linkedEntityId (docente)');
    return this.service.updateAsTeacher(id, String(teacherId), dto);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
