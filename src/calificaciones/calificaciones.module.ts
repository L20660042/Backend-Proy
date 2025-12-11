import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalificacionesController } from './calificaciones.controller';
import { CalificacionesService } from './calificaciones.service';
import { Calificacion, CalificacionSchema } from './calificaciones.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Calificacion', schema: CalificacionSchema }]), // Registra el esquema de calificaciones
  ],
  controllers: [CalificacionesController], // Controlador de calificaciones
  providers: [CalificacionesService], // Servicio de calificaciones
})
export class CalificacionesModule {}
