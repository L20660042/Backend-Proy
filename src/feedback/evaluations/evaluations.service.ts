import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TeacherEvaluation, TeacherEvaluationDocument } from './schemas/teacher-evaluation.schema';
import { CreateTeacherEvaluationDto } from './dto/create-evaluation.dto';
import { AiClientService } from '../ai/ai.client';
import { EVALUATION_ITEMS, EvaluationItemKey } from './evaluation-template';

import { CourseEnrollment, CourseEnrollmentDocument } from '../../academic/course-enrollments/schemas/course-enrollment.schema';
import { ClassAssignment, ClassAssignmentDocument } from '../../academic/class-assignments/schemas/class-assignment.schema';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectModel(TeacherEvaluation.name) private readonly evalModel: Model<TeacherEvaluationDocument>,
    @InjectModel(CourseEnrollment.name) private readonly ceModel: Model<CourseEnrollmentDocument>,
    @InjectModel(ClassAssignment.name) private readonly caModel: Model<ClassAssignmentDocument>,
    private readonly ai: AiClientService,
  ) {}

private validateRatings(ratings: Record<string, number>) {
  if (!ratings || typeof ratings !== 'object') {
    throw new BadRequestException('ratings requerido');
  }

  const allowed = new Set<EvaluationItemKey>(EVALUATION_ITEMS.map((i) => i.key));

  // Validar que no haya keys extrañas
  for (const k of Object.keys(ratings) as string[]) {
    if (!allowed.has(k as EvaluationItemKey)) {
      throw new BadRequestException(`Item inválido en ratings: ${k}`);
    }
  }

  // Validar rangos + que estén todos
  for (const item of EVALUATION_ITEMS) {
    const v = (ratings as any)[item.key];
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      throw new BadRequestException(`Rating inválido en ${item.key} (1..5)`);
    }
    }
    }

  async createAsStudent(user: any, dto: CreateTeacherEvaluationDto) {
    const roles: string[] = user?.roles ?? [];
    const studentId = user?.linkedEntityId;

    if (!roles.includes('ALUMNO')) throw new ForbiddenException('Solo ALUMNO puede evaluar');
    if (!studentId) throw new ForbiddenException('Usuario sin linkedEntityId (alumno)');

    if (!dto.periodId) throw new BadRequestException('periodId requerido');
    if (!dto.classAssignmentId) throw new BadRequestException('classAssignmentId requerido');

    this.validateRatings(dto.ratings);

    // Carga
    const ca = await this.caModel.findById(dto.classAssignmentId).lean();
    if (!ca) throw new BadRequestException('ClassAssignment no existe');

    const caPeriod = String((ca as any).periodId);
    if (caPeriod !== String(dto.periodId)) {
      throw new BadRequestException('La carga no pertenece al periodo indicado');
    }

    // Validar que el alumno esté inscrito a esa carga (course enrollment activo)
    const ce = await this.ceModel.findOne({
      periodId: dto.periodId,
      studentId: String(studentId),
      classAssignmentId: dto.classAssignmentId,
      status: 'active',
    }).lean();

    if (!ce) throw new ForbiddenException('No estás inscrito a esa materia/carga en este periodo');

    try {
      const created = await this.evalModel.create({
        periodId: dto.periodId,
        classAssignmentId: dto.classAssignmentId,
        studentId: String(studentId),
        teacherId: String((ca as any).teacherId),
        groupId: String((ca as any).groupId),
        subjectId: String((ca as any).subjectId),
        ratings: dto.ratings,
        comment: String(dto.comment ?? '').trim(),
        status: 'submitted',
        analysis: null,
      });

      // IA (no rompe si falla)
      const text = String(dto.comment ?? '').trim();
      if (text) {
        const analysis = await this.ai.analyzeText({
          text,
          lang: 'es',
          tasks: ['sentiment', 'topics', 'summary'],
        });
        if (analysis) {
          await this.evalModel.updateOne({ _id: created._id }, { $set: { analysis } });
        }
      }

      return { message: 'Evaluación registrada', id: String(created._id) };
    } catch (e: any) {
      if (String(e?.message ?? '').includes('E11000')) {
        throw new BadRequestException('Ya evaluaste esta carga en este periodo');
      }
      throw e;
    }
  }

  async listMyEvaluations(user: any, periodId: string) {
    const roles: string[] = user?.roles ?? [];
    const studentId = user?.linkedEntityId;
    if (!roles.includes('ALUMNO')) throw new ForbiddenException('Solo ALUMNO');
    if (!studentId) throw new ForbiddenException('Usuario sin linkedEntityId');
    if (!periodId) throw new BadRequestException('periodId requerido');

    return this.evalModel
      .find({ periodId, studentId: String(studentId) })
      .populate('classAssignmentId')
      .populate('subjectId')
      .populate('teacherId')
      .populate('groupId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async teacherSummary(user: any, periodId: string) {
    const roles: string[] = user?.roles ?? [];
    const teacherId = user?.linkedEntityId;

    if (!roles.includes('DOCENTE')) throw new ForbiddenException('Solo DOCENTE');
    if (!teacherId) throw new ForbiddenException('Usuario sin linkedEntityId');
    if (!periodId) throw new BadRequestException('periodId requerido');

    const docs = await this.evalModel
      .find({ periodId, teacherId: String(teacherId) })
      .select({ ratings: 1, analysis: 1, subjectId: 1, groupId: 1 })
      .populate('subjectId')
      .populate('groupId')
      .lean();

    const count = docs.length;

    // Promedios por item
    const sums: Record<string, number> = {};
    const avgs: Record<string, number> = {};
    for (const item of EVALUATION_ITEMS) sums[item.key] = 0;

    for (const d of docs) {
      const r = (d as any).ratings ?? {};
      for (const item of EVALUATION_ITEMS) {
        const n = Number(r[item.key] ?? 0);
        sums[item.key] += n;
      }
    }
    for (const item of EVALUATION_ITEMS) {
      avgs[item.key] = count ? Math.round((sums[item.key] / count) * 100) / 100 : 0;
    }

    // Sentimiento agregado (si viene)
    const sentimentCounts: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};

    for (const d of docs) {
      const s = (d as any).analysis?.sentiment?.label;
      if (s) sentimentCounts[s] = (sentimentCounts[s] ?? 0) + 1;

      const topics = (d as any).analysis?.topics;
      if (Array.isArray(topics)) {
        for (const t of topics) {
          const label = String(t?.label ?? '').trim();
          if (!label) continue;
          topicCounts[label] = (topicCounts[label] ?? 0) + 1;
        }
      }
    }

    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, n]) => ({ label, count: n }));

    return {
      periodId,
      teacherId: String(teacherId),
      totalEvaluations: count,
      averages: avgs,
      sentimentCounts,
      topTopics,
      items: EVALUATION_ITEMS,
    };
  }
}
