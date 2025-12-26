import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ScheduleBlocksService } from '../schedule-blocks/schedule-blocks.service';
import { CourseEnrollmentsService } from '../course-enrollments/course-enrollments.service';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly courseEnrollments: CourseEnrollmentsService,
    private readonly blocks: ScheduleBlocksService,
  ) {}

  async getTeacherSchedule(periodId: string, teacherId: string) {
    if (!periodId) throw new BadRequestException('periodId requerido');
    return this.blocks.findAll({ periodId, teacherId });
  }

  async getGroupSchedule(periodId: string, groupId: string) {
    if (!periodId) throw new BadRequestException('periodId requerido');
    return this.blocks.findAll({ periodId, groupId });
  }

  async getStudentSchedule(periodId: string, studentId: string) {
    if (!periodId) throw new BadRequestException('periodId requerido');

    const ces = await this.courseEnrollments.findActiveByStudentAndPeriod(periodId, studentId);

    if (!ces || ces.length === 0) {
      throw new NotFoundException('El alumno no tiene materias inscritas (course-enrollments) en ese periodo');
    }

    // Deduplicar triples por si hay registros repetidos por errores previos
    const seen = new Set<string>();
    const triples: Array<{ groupId: string; subjectId: string; teacherId: string }> = [];

    for (const ce of ces as any[]) {
      const groupId = String(ce.groupId);
      const subjectId = String(ce.subjectId);
      const teacherId = String(ce.teacherId);

      const key = `${groupId}|${subjectId}|${teacherId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      triples.push({ groupId, subjectId, teacherId });
    }

    return this.blocks.findByClassTriples({ periodId, triples });
  }

  // /academic/schedule/me
  async getMySchedule(user: any, periodId?: string) {
    const roles: string[] = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
    const linkedEntityId: string | null = user?.linkedEntityId ?? null;

    if (!linkedEntityId) {
      throw new ForbiddenException('El usuario no tiene linkedEntityId');
    }
    if (!periodId) {
      throw new BadRequestException('periodId requerido para /academic/schedule/me');
    }

    // Docente -> linkedEntityId es teacherId
    if (roles.includes('DOCENTE')) {
      return this.getTeacherSchedule(periodId, linkedEntityId);
    }

    // Alumno -> linkedEntityId es studentId
    if (roles.includes('ALUMNO') || roles.includes('ESTUDIANTE')) {
      return this.getStudentSchedule(periodId, linkedEntityId);
    }

    throw new ForbiddenException('Rol no autorizado para consultar /academic/schedule/me');
  }
}
