import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ScheduleBlocksService } from '../schedule-blocks/schedule-blocks.service';
import { CourseEnrollmentsService } from '../course-enrollments/course-enrollments.service';
import { ActivityEnrollmentsService } from '../activity-enrollments/activity-enrollments.service';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly courseEnrollments: CourseEnrollmentsService,
    private readonly blocks: ScheduleBlocksService,
    private readonly activityEnrollments: ActivityEnrollmentsService,
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

    // 1) Horario de clases (por course-enrollments)
    const ces = await this.courseEnrollments.findActiveByStudentAndPeriod(periodId, studentId);
    let classBlocks: any[] = [];
    if (ces && (ces as any[]).length > 0) {
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

      classBlocks = await this.blocks.findByClassTriples({ periodId, triples });
    }

    // 2) Horario de extraescolares (por activity-enrollments)
    const aes = await this.activityEnrollments.findActiveByStudentAndPeriod(periodId, studentId);
    let extraBlocks: any[] = [];
    if (aes && (aes as any[]).length > 0) {
      const activityIds = (aes as any[]).map((a) => String(a.activityId));
      extraBlocks = await this.blocks.findByActivityIds({ periodId, activityIds });
    }

    const merged = [...(classBlocks ?? []), ...(extraBlocks ?? [])];
    if (merged.length === 0) {
      throw new NotFoundException('El alumno no tiene bloques de horario (clases o extraescolares) en ese periodo');
    }

    merged.sort((a: any, b: any) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return String(a.startTime).localeCompare(String(b.startTime));
    });

    return merged;
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
