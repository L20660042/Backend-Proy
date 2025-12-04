import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';


@Controller('users')
@UseGuards(JwtGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ======================================================
  // Crear usuario (solo admin / superadmin)
  // ======================================================
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // ======================================================
  // Obtener todos (RLS aplicado en servicio)
  // ======================================================
  @Get()
  findAll(@Req() req) {
    return this.usersService.findAll(req.user);
  }

  // ======================================================
  // Obtener por ID
  // ======================================================
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // ======================================================
  // Actualizar usuario
  // ======================================================
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // ======================================================
  // Activar/Desactivar usuario
  // ======================================================
  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  toggleActive(@Param('id') id: string) {
    return this.usersService.toggleActive(id);
  }

  // ======================================================
  // Eliminar usuario
  // ======================================================
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
