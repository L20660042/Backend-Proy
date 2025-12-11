import { Controller, Post, Get, Body, Param, Put, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { CalificacionesService } from './calificaciones.service';
import { JwtGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRole } from 'src/common/enums';

@Controller('calificaciones')
@UseGuards(JwtGuard, RolesGuard)
export class CalificacionesController {
  constructor(private readonly calificacionesService: CalificacionesService) {}

  // Crear una calificación
  @Post()
  async crear(@Body() calificacionDto: any) {
    return this.calificacionesService.crearCalificacion(calificacionDto);
  }

  // Obtener las calificaciones de un estudiante
  @Get(':estudianteId')
  async obtener(
    @Param('estudianteId') estudianteId: string,
    @Req() req: any,
  ) {
    const user = req.user;

    // Si es estudiante, solo puede ver sus propias calificaciones
    if (user.role === UserRole.ESTUDIANTE && user._id !== estudianteId) {
      throw new ForbiddenException('No puedes ver calificaciones de otros estudiantes');
    }

    return this.calificacionesService.obtenerCalificacionesPorEstudiante(estudianteId);
  }

  // Actualizar una calificación
  @Put(':id')
  async actualizar(@Param('id') id: string, @Body() calificacionDto: any) {
    return this.calificacionesService.actualizarCalificacion(id, calificacionDto);
  }
   @Get(':estudianteId/riesgo')
  async obtenerRiesgo(
    @Param('estudianteId') estudianteId: string,
    @Req() req: any,
  ) {
    const user = req.user;

    // Misma validación de seguridad que antes
    if (user.role === UserRole.ESTUDIANTE && user._id !== estudianteId) {
      throw new ForbiddenException('No puedes ver el riesgo de otros estudiantes');
    }

    return this.calificacionesService.obtenerRiesgoEstudiante(estudianteId);
  }
}
