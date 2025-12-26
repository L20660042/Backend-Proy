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
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ClassAssignmentsService } from './class-assignments.service';
import { CreateClassAssignmentDto } from './dto/create-class-assignment.dto';
import { UpdateClassAssignmentDto } from './dto/update-class-assignment.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

@Controller('academic/class-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassAssignmentsController {
  constructor(private readonly service: ClassAssignmentsService) {}

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Post()
  create(@Body() dto: CreateClassAssignmentDto) {
    return this.service.create(dto);
  }

  @Roles(Role.DOCENTE)
  @Get('me')
  findMine(
    @Req() req: any,
    @Query('periodId') periodId?: string,
    @Query('status') status?: string,
  ) {
    const teacherId = req.user?.linkedEntityId;
    if (!teacherId) throw new ForbiddenException('Usuario docente sin linkedEntityId');
    if (!periodId) throw new BadRequestException('periodId requerido');

    return this.service.findAll({ periodId, teacherId, status: status ?? 'active' });
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get('group-summary')
  groupSummary(
    @Query('periodId') periodId?: string,
    @Query('careerId') careerId?: string,
    @Query('groupId') groupId?: string,
    @Query('status') status?: string,
  ) {
    if (!periodId) throw new BadRequestException('periodId requerido');
    if (!groupId) throw new BadRequestException('groupId requerido');

    return this.service.findGroupSummary({
      periodId,
      careerId,
      groupId,
      status: status ?? 'active',
    });
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get()
  findAll(
    @Query('periodId') periodId?: string,
    @Query('careerId') careerId?: string,
    @Query('groupId') groupId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({ periodId, careerId, groupId, subjectId, teacherId, status });
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClassAssignmentDto) {
    return this.service.update(id, dto);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
