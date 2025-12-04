import { Controller, Get, Post, Patch, Param, Body, Delete, UseGuards } from '@nestjs/common';
import { CapacitacionService } from './capacitacion.service';
import { CreateCapacitacionDto } from './dto/create-capacitacion.dto';
import { UpdateCapacitacionDto } from './dto/update-capacitacion.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('capacitacion')
@UseGuards(JwtGuard, RolesGuard)
export class CapacitacionController {
  constructor(private readonly capacitacionService: CapacitacionService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.CAPACITACION)
  create(@Body() dto: CreateCapacitacionDto) {
    return this.capacitacionService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.CAPACITACION)
  findAll() {
    return this.capacitacionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.capacitacionService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.CAPACITACION)
  update(@Param('id') id: string, @Body() dto: UpdateCapacitacionDto) {
    return this.capacitacionService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  delete(@Param('id') id: string) {
    return this.capacitacionService.delete(id);
  }

  @Get('teacher/:teacherId')
  findByTeacher(@Param('teacherId') teacherId: string) {
    return this.capacitacionService.findByTeacher(teacherId);
  }
}
