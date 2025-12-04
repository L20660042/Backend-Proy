import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('alerts')
@UseGuards(JwtGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO, UserRole.DOCENTE, UserRole.TUTOR)
  create(@Body() dto: CreateAlertDto) {
    return this.alertsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  findAll() {
    return this.alertsService.findAll();
  }

  @Patch('resolve/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  resolve(@Param('id') id: string) {
    return this.alertsService.resolve(id);
  }
}
