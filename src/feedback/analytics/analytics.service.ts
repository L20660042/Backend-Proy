import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TeacherEvaluation, TeacherEvaluationDocument } from '../evaluations/schemas/teacher-evaluation.schema';
import { TeacherComplaint, TeacherComplaintDocument } from '../complaints/schemas/teacher-complaint.schema';
import { EVALUATION_ITEMS } from '../evaluations/evaluation-template';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(TeacherEvaluation.name) private readonly evalModel: Model<TeacherEvaluationDocument>,
    @InjectModel(TeacherComplaint.name) private readonly compModel: Model<TeacherComplaintDocument>,
  ) {}

  async overview(periodId: string) {
    if (!periodId) throw new BadRequestException('periodId requerido');

    // 1) Evaluaciones por docente
    const evals = await this.evalModel
      .find({ periodId })
      .select({ teacherId: 1, ratings: 1 })
      .populate('teacherId')
      .lean();

    const byTeacher: Record<string, any> = {};

    for (const e of evals) {
      const tid = String((e as any).teacherId?._id ?? (e as any).teacherId);
      if (!byTeacher[tid]) {
        byTeacher[tid] = {
          teacherId: tid,
          teacherName: (e as any).teacherId?.name ?? '',
          countEvaluations: 0,
          sums: Object.fromEntries(EVALUATION_ITEMS.map((i) => [i.key, 0])),
        };
      }
      byTeacher[tid].countEvaluations += 1;
      const r = (e as any).ratings ?? {};
      for (const i of EVALUATION_ITEMS) {
        byTeacher[tid].sums[i.key] += Number(r[i.key] ?? 0);
      }
    }

    // 2) Quejas por docente
    const comps = await this.compModel
      .find({ periodId, teacherId: { $ne: null } })
      .select({ teacherId: 1, status: 1 })
      .populate('teacherId')
      .lean();

    for (const c of comps) {
      const tid = String((c as any).teacherId?._id ?? (c as any).teacherId);
      if (!byTeacher[tid]) {
        byTeacher[tid] = {
          teacherId: tid,
          teacherName: (c as any).teacherId?.name ?? '',
          countEvaluations: 0,
          sums: Object.fromEntries(EVALUATION_ITEMS.map((i) => [i.key, 0])),
        };
      }
      byTeacher[tid].countComplaints = (byTeacher[tid].countComplaints ?? 0) + 1;
      byTeacher[tid].complaintsOpen = (byTeacher[tid].complaintsOpen ?? 0) + ((c as any).status === 'open' ? 1 : 0);
    }

    // Promedios
    const rows = Object.values(byTeacher).map((t: any) => {
      const n = t.countEvaluations || 0;
      const averages: Record<string, number> = {};
      for (const i of EVALUATION_ITEMS) {
        averages[i.key] = n ? Math.round((t.sums[i.key] / n) * 100) / 100 : 0;
      }
      return {
        teacherId: t.teacherId,
        teacherName: t.teacherName,
        countEvaluations: n,
        countComplaints: t.countComplaints ?? 0,
        complaintsOpen: t.complaintsOpen ?? 0,
        averages,
      };
    });

    // Orden: más quejas abiertas primero, luego peor promedio (clarity como proxy)
    rows.sort((a: any, b: any) => {
      if (b.complaintsOpen !== a.complaintsOpen) return b.complaintsOpen - a.complaintsOpen;
      return (a.averages.clarity ?? 0) - (b.averages.clarity ?? 0);
    });

    return { periodId, items: EVALUATION_ITEMS, teachers: rows };
  }
}
