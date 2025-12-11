import { CalificacionDto } from './dto/calificacion.dto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Calificacion } from './calificaciones.schema';
import axios from 'axios';


@Injectable()
export class CalificacionesService {
  constructor(
    @InjectModel('Calificacion') private readonly calificacionModel: Model<Calificacion>,
  ) {}

  // Crear una nueva calificación
  async crearCalificacion(calificacionDto: CalificacionDto): Promise<Calificacion> {
    const nuevaCalificacion = new this.calificacionModel(calificacionDto);
    return await nuevaCalificacion.save();
  }

  // Obtener las calificaciones de un estudiante
  async obtenerCalificacionesPorEstudiante(estudianteId: string): Promise<Calificacion[]> {
    return await this.calificacionModel.find({ estudianteId }).exec();
  }

async actualizarCalificacion(id: string, calificacionDto: CalificacionDto): Promise<Calificacion> {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('ID inválido');
  }

  const updatedCalificacion = await this.calificacionModel.findByIdAndUpdate(id, calificacionDto, { new: true });

  if (!updatedCalificacion) {
    throw new Error('Calificación no encontrada');
  }

  return updatedCalificacion; // Ahora TypeScript sabe que no es null
}
  async obtenerRiesgoEstudiante(estudianteId: string) {
    // 1. Obtener calificaciones
    const calificaciones = await this.calificacionModel.find({ estudianteId }).exec();

    const grades = calificaciones.map(c => c.calificacion);
    // Por ahora puedes mandar asistencia/evaluaciones simples o dummy
    const attendance = calificaciones.map(() => 100); // placeholder
    const tutoringSessions = 0; // hasta que integres datos reales
    const evaluationScores = grades; // mientras no haya otra métrica

    try {
      const mlUrl = process.env.ML_SERVICE_URL 
        || 'https://ml-service-production-fff9.up.railway.app';

      const response = await axios.post(`${mlUrl}/api/analyze/student-risk`, {
        grades,
        attendance,
        tutoring_sessions: tutoringSessions,
        evaluation_scores: evaluationScores,
      });

      return {
        estudianteId,
        risk_level: response.data.risk_level,
        confidence: response.data.confidence,
        risk_factors: response.data.risk_factors,
        recommendations: response.data.recommendations,
      };
    } catch (e) {
      throw new HttpException(
        'Error al comunicarse con el servicio de riesgo académico',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}