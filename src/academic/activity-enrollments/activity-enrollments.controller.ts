import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

import { ActivityEnrollmentsService } from './activity-enrollments.service';

@Controller('academic/activity-enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityEnrollmentsController {
  constructor(private readonly service: ActivityEnrollmentsService) {}

  // ALUMNO: mis actividades del periodo
  @Roles(Role.ALUMNO)
  @Get('me')
  getMy(@Req() req: any, @Query('periodId') periodId?: string) {
    if (!periodId) throw new BadRequestException('periodId requerido');
    return this.service.getMy(periodId, req.user);
  }

  // ADMIN/CONTROL: listado
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get()
  findAll(
    @Query('periodId') periodId?: string,
    @Query('activityId') activityId?: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({ periodId, activityId, studentId, status });
  }

  // ✅ REPORTE: devuelve rows + csv (para copiar)
  // IMPORTANTE: va ANTES de :id para que "report" no se interprete como id.
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get('report')
  report(
    @Query('periodId') periodId?: string,
    @Query('activityId') activityId?: string,
    @Query('status') status?: string,
  ) {
    if (!periodId) throw new BadRequestException('periodId requerido');
    if (!activityId) throw new BadRequestException('activityId requerido');
    return this.service.reportByActivity({ periodId, activityId, status: status ?? 'active' });
  }

  // ADMIN/CONTROL: crear inscripción individual
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Post()
  create(@Body() dto: { periodId: string; studentId: string; activityId: string; status?: 'active' | 'inactive' }) {
    return this.service.create(dto);
  }

  // ADMIN/CONTROL: bulk
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Post('bulk')
  bulk(@Body() dto: { periodId: string; activityId: string; studentIds: string[]; status?: 'active' | 'inactive' }) {
    return this.service.bulk(dto);
  }

  // ADMIN/CONTROL: ver uno
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ADMIN/CONTROL: eliminar
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
