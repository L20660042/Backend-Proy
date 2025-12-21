import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { ScheduleBlocksService } from '../schedule-blocks/schedule-blocks.service';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly blocks: ScheduleBlocksService,
  ) {}

  async getTeacherSchedule(periodId: string, teacherId: string) {
    return this.blocks.findAll({ periodId, teacherId });
  }

  async getGroupSchedule(periodId: string, groupId: string) {
    return this.blocks.findAll({ periodId, groupId });
  }

  async getStudentSchedule(periodId: string, studentId: string) {
    const enrollment = await this.enrollments.findActiveByStudentAndPeriod(periodId, studentId);

    if (!enrollment) {
      throw new NotFoundException('El alumno no tiene inscripción activa en ese periodo');
    }

    // Horario de clases del grupo donde está inscrito
    return this.blocks.findAll({ periodId, groupId: String(enrollment.groupId) });
  }
  async getMySchedule(user: any, periodId: string) {
  const roles: string[] = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const linkedEntityId: string | null = user?.linkedEntityId ?? null;

  if (!linkedEntityId) {
    // Sin vínculo, no se puede resolver "mi horario"
    throw new ForbiddenException('El usuario no tiene linkedEntityId');
  }

  // Docente → usa teacherId = linkedEntityId
  if (roles.includes('DOCENTE')) {
    return this.getTeacherSchedule(periodId, linkedEntityId);
  }

  // Alumno/Estudiante → usa studentId = linkedEntityId
  if (roles.includes('ALUMNO') || roles.includes('ESTUDIANTE')) {
    return this.getStudentSchedule(periodId, linkedEntityId);
  }

  // Otros roles no tienen "mi horario" por ahora
  throw new ForbiddenException('Rol no autorizado para consultar /me');
}

}
