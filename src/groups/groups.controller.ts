import { Controller, Get, Post, Patch, Param, Body, Delete, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';


@Controller('groups')
@UseGuards(JwtGuard, RolesGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get()
  findAll() {
    return this.groupsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  toggleActive(@Param('id') id: string) {
    return this.groupsService.toggleActive(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  delete(@Param('id') id: string) {
    return this.groupsService.delete(id);
  }

  @Patch(':id/add-students')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  addStudents(@Param('id') id: string, @Body('students') studentIds: string[]) {
    return this.groupsService.addStudents(id, studentIds);
  }

  @Patch(':id/remove-students')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  removeStudents(@Param('id') id: string, @Body('students') studentIds: string[]) {
    return this.groupsService.removeStudents(id, studentIds);
  }
}
