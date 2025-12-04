import { Controller, Get, Post, Patch, Param, Body, Delete, UseGuards } from '@nestjs/common';
import { TutoriaService } from './tutoria.service';
import { CreateTutoriaDto } from './dto/create-tutoria.dto';
import { UpdateTutoriaDto } from './dto/update-tutoria.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('tutoria')
@UseGuards(JwtGuard, RolesGuard)
export class TutoriaController {
  constructor(private readonly tutoriaService: TutoriaService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TUTOR, UserRole.DOCENTE)
  create(@Body() dto: CreateTutoriaDto) {
    return this.tutoriaService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TUTOR, UserRole.DOCENTE)
  findAll() {
    return this.tutoriaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tutoriaService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TUTOR, UserRole.DOCENTE)
  update(@Param('id') id: string, @Body() dto: UpdateTutoriaDto) {
    return this.tutoriaService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  delete(@Param('id') id: string) {
    return this.tutoriaService.delete(id);
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.tutoriaService.findByStudent(studentId);
  }

  @Get('tutor/:tutorId')
  findByTutor(@Param('tutorId') tutorId: string) {
    return this.tutoriaService.findByTutor(tutorId);
  }

  @Get('group/:groupId')
  findByGroup(@Param('groupId') groupId: string) {
    return this.tutoriaService.findByGroup(groupId);
  }
}
