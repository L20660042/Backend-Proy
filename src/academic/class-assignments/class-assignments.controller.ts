import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ClassAssignmentsService } from './class-assignments.service';
import { CreateClassAssignmentDto } from './dto/create-class-assignment.dto';
import { UpdateClassAssignmentDto } from './dto/update-class-assignment.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
@Controller('academic/class-assignments')
export class ClassAssignmentsController {
  constructor(private readonly service: ClassAssignmentsService) {}

  @Post()
  create(@Body() dto: CreateClassAssignmentDto) {
    return this.service.create(dto);
  }

  // GET /academic/class-assignments?periodId=...&groupId=...&teacherId=...
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClassAssignmentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
