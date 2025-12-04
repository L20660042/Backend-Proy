import { Controller, Get, Post, Patch, Param, Body, Delete, UseGuards, Req } from '@nestjs/common';
import { CareersService } from './careers.service';
import { CreateCareerDto } from './dto/create-career.dto';
import { UpdateCareerDto } from './dto/update-career.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';


@Controller('careers')
@UseGuards(JwtGuard, RolesGuard)
export class CareersController {
  constructor(private readonly careersService: CareersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(@Body() dto: CreateCareerDto) {
    return this.careersService.create(dto);
  }

  @Get()
  findAll() {
    return this.careersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.careersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCareerDto) {
    return this.careersService.update(id, dto);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  toggleActive(@Param('id') id: string) {
    return this.careersService.toggleActive(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  delete(@Param('id') id: string) {
    return this.careersService.delete(id);
  }
}
