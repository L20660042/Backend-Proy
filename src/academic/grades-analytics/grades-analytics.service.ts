import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  CourseEnrollment,
  CourseEnrollmentDocument,
} from '../course-enrollments/schemas/course-enrollment.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherDocument } from '../teachers/schemas/teacher.schema';
import { Period, PeriodDocument } from '../periods/schemas/period.schema';

type OverviewParams = {
  periodId: string;
  careerId?: string;
  groupId?: string;
  teacherId?: string;
  subjectId?: string;

  passThreshold?: number; // default 70
  failRateMin?: number; // default 0.40
  minCount?: number; // default 10
  topN?: number; // default 10
};

function toObjectId(id: string | undefined, field: string): Types.ObjectId | undefined {
  if (!id) return undefined;
  if (!Types.ObjectId.isValid(id)) throw new BadRequestException(`${field} inválido`);
  return new Types.ObjectId(id);
}

function toNumber(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pct(x: number) {
  return Number((x * 100).toFixed(2));
}

function normalizeDistribution(dist: Array<{ bucket: string; count: number }>) {
  const wanted = ['0-59', '60-69', '70-79', '80-89', '90-100'] as const;
  const map = new Map<string, number>();
  for (const x of dist ?? []) map.set(x.bucket, x.count);
  return wanted.map((b) => ({ bucket: b, count: map.get(b) ?? 0 }));
}

@Injectable()
export class GradesAnalyticsService {
  constructor(
    @InjectModel(CourseEnrollment.name)
    private readonly ceModel: Model<CourseEnrollmentDocument>,

    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,

    @InjectModel(Subject.name)
    private readonly subjectModel: Model<SubjectDocument>,

    @InjectModel(Teacher.name)
    private readonly teacherModel: Model<TeacherDocument>,

    @InjectModel(Period.name)
    private readonly periodModel: Model<PeriodDocument>,
  ) {}

  async overview(params: OverviewParams) {
    const periodObjId = toObjectId(params.periodId, 'periodId');
    if (!periodObjId) throw new BadRequestException('periodId requerido');

    const passThreshold = toNumber(params.passThreshold, 70);
    const failRateMin = toNumber(params.failRateMin, 0.4);
    const minCount = Math.max(1, Math.floor(toNumber(params.minCount, 10)));
    const topN = Math.max(1, Math.floor(toNumber(params.topN, 10)));

    const careerId = toObjectId(params.careerId, 'careerId');
    const groupId = toObjectId(params.groupId, 'groupId');
    const teacherId = toObjectId(params.teacherId, 'teacherId');
    const subjectId = toObjectId(params.subjectId, 'subjectId');

    // Base filter: periodo + activos
    const match: any = {
      periodId: periodObjId,
      status: 'active',
    };

    if (groupId) match.groupId = groupId;
    if (teacherId) match.teacherId = teacherId;
    if (subjectId) match.subjectId = subjectId;

    // Filtro por careerId se resuelve via Group
    if (careerId && !groupId) {
      const groups = await this.groupModel
        .find({ periodId: periodObjId, careerId }, { _id: 1 })
        .lean();
      const groupIds = (groups as any[]).map((g) => g._id);
      match.groupId = { $in: groupIds };
    }

    const period: any = await this.periodModel.findById(periodObjId).select('name').lean();

    // Robust: treat missing finalGrade as null
    const finalExpr = { $ifNull: ['$finalGrade', null] };
    const withFinalExpr = { $cond: [{ $ne: [finalExpr, null] }, 1, 0] };
    const passedExpr = {
      $cond: [
        { $and: [{ $ne: [finalExpr, null] }, { $gte: [finalExpr, passThreshold] }] },
        1,
        0,
      ],
    };
    const failedExpr = {
      $cond: [
        { $and: [{ $ne: [finalExpr, null] }, { $lt: [finalExpr, passThreshold] }] },
        1,
        0,
      ],
    };

    // 1) Summary global
    const summaryAgg = await this.ceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          withFinal: { $sum: withFinalExpr },
          avgFinal: { $avg: finalExpr },
          passed: { $sum: passedExpr },
          failed: { $sum: failedExpr },
        },
      },
      {
        $project: {
          _id: 0,
          total: 1,
          withFinal: 1,
          avgFinal: { $round: ['$avgFinal', 2] },
          passed: 1,
          failed: 1,
          incomplete: { $subtract: ['$total', '$withFinal'] },
        },
      },
    ]);

    const summary =
      summaryAgg?.[0] ??
      ({
        total: 0,
        withFinal: 0,
        avgFinal: null,
        passed: 0,
        failed: 0,
        incomplete: 0,
      } as any);

    // 2) Distribución (solo con finalGrade >= 0)
    const distributionAggRaw = await this.ceModel.aggregate([
      { $match: { ...match, finalGrade: { $gte: 0 } } },
      {
        $addFields: {
          bucket: {
            $switch: {
              branches: [
                { case: { $lte: ['$finalGrade', 59] }, then: { label: '0-59', order: 1 } },
                {
                  case: { $and: [{ $gte: ['$finalGrade', 60] }, { $lte: ['$finalGrade', 69] }] },
                  then: { label: '60-69', order: 2 },
                },
                {
                  case: { $and: [{ $gte: ['$finalGrade', 70] }, { $lte: ['$finalGrade', 79] }] },
                  then: { label: '70-79', order: 3 },
                },
                {
                  case: { $and: [{ $gte: ['$finalGrade', 80] }, { $lte: ['$finalGrade', 89] }] },
                  then: { label: '80-89', order: 4 },
                },
                { case: { $gte: ['$finalGrade', 90] }, then: { label: '90-100', order: 5 } },
              ],
              default: { label: 'N/A', order: 99 },
            },
          },
        },
      },
      {
        $group: {
          _id: '$bucket.label',
          order: { $min: '$bucket.order' },
          count: { $sum: 1 },
        },
      },
      { $sort: { order: 1 } },
      { $project: { _id: 0, bucket: '$_id', count: 1 } },
    ]);

    const distribution = normalizeDistribution(distributionAggRaw as any);

    // 3) Promedios por group/subject/teacher
    const groupAgg = await this.ceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$groupId',
          withFinal: { $sum: withFinalExpr },
          avgFinal: { $avg: finalExpr },
          passed: { $sum: passedExpr },
          failed: { $sum: failedExpr },
        },
      },
      {
        $project: {
          _id: 0,
          groupId: '$_id',
          withFinal: 1,
          avgFinal: { $round: ['$avgFinal', 2] },
          passed: 1,
          failed: 1,
          failRate: {
            $cond: [{ $gt: ['$withFinal', 0] }, { $divide: ['$failed', '$withFinal'] }, 0],
          },
        },
      },
      { $sort: { avgFinal: -1 } },
      { $limit: 500 },
    ]);

    const subjectAgg = await this.ceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subjectId',
          withFinal: { $sum: withFinalExpr },
          avgFinal: { $avg: finalExpr },
          passed: { $sum: passedExpr },
          failed: { $sum: failedExpr },
        },
      },
      {
        $project: {
          _id: 0,
          subjectId: '$_id',
          withFinal: 1,
          avgFinal: { $round: ['$avgFinal', 2] },
          passed: 1,
          failed: 1,
          failRate: {
            $cond: [{ $gt: ['$withFinal', 0] }, { $divide: ['$failed', '$withFinal'] }, 0],
          },
        },
      },
      { $sort: { avgFinal: -1 } },
      { $limit: 1000 },
    ]);

    const teacherAgg = await this.ceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$teacherId',
          withFinal: { $sum: withFinalExpr },
          avgFinal: { $avg: finalExpr },
          passed: { $sum: passedExpr },
          failed: { $sum: failedExpr },
        },
      },
      {
        $project: {
          _id: 0,
          teacherId: '$_id',
          withFinal: 1,
          avgFinal: { $round: ['$avgFinal', 2] },
          passed: 1,
          failed: 1,
          failRate: {
            $cond: [{ $gt: ['$withFinal', 0] }, { $divide: ['$failed', '$withFinal'] }, 0],
          },
        },
      },
      { $sort: { avgFinal: -1 } },
      { $limit: 1000 },
    ]);

    // 4) Focos rojos: materias con alta reprobación
    const redFlagsRaw = await this.ceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subjectId',
          withFinal: { $sum: withFinalExpr },
          avgFinal: { $avg: finalExpr },
          passed: { $sum: passedExpr },
          failed: { $sum: failedExpr },
        },
      },
      {
        $addFields: {
          failRate: {
            $cond: [{ $gt: ['$withFinal', 0] }, { $divide: ['$failed', '$withFinal'] }, 0],
          },
        },
      },
      {
        $match: {
          withFinal: { $gte: minCount },
          failRate: { $gte: failRateMin },
        },
      },
      {
        $project: {
          _id: 0,
          subjectId: '$_id',
          withFinal: 1,
          avgFinal: { $round: ['$avgFinal', 2] },
          passed: 1,
          failed: 1,
          failRate: 1,
        },
      },
      { $sort: { failRate: -1, withFinal: -1 } },
      { $limit: 200 },
    ]);

    // Resolve names (tipado “safe” para TS estricto)
    const groupIds = (groupAgg as any[]).map((x) => x.groupId).filter(Boolean);
    const teacherIds = (teacherAgg as any[]).map((x) => x.teacherId).filter(Boolean);

    const subjectIdsSet = new Set<string>();
    for (const x of subjectAgg as any[]) subjectIdsSet.add(String(x.subjectId));
    for (const x of redFlagsRaw as any[]) subjectIdsSet.add(String(x.subjectId));
    const subjectIds = Array.from(subjectIdsSet).filter(Boolean);

    const [groups, subjects, teachers] = await Promise.all([
      groupIds.length
        ? this.groupModel.find({ _id: { $in: groupIds } }, { name: 1 }).lean()
        : [],
      subjectIds.length
        ? this.subjectModel.find({ _id: { $in: subjectIds } }, { name: 1, code: 1 }).lean()
        : [],
      teacherIds.length
        ? this.teacherModel.find({ _id: { $in: teacherIds } }, { name: 1 }).lean()
        : [],
    ]);

    // ✅ FIX TS2769: construir Maps a mano tipados como Map<string, any>
    const groupMap: Map<string, any> = new Map();
    for (const g of groups as any[]) groupMap.set(String(g._id), g);

    const subjectMap: Map<string, any> = new Map();
    for (const s of subjects as any[]) subjectMap.set(String(s._id), s);

    const teacherMap: Map<string, any> = new Map();
    for (const t of teachers as any[]) teacherMap.set(String(t._id), t);

    const byGroup = (groupAgg as any[]).map((x) => ({
      ...x,
      groupId: String(x.groupId),
      groupName: (groupMap.get(String(x.groupId)) as any)?.name ?? '',
      failRate: Number((x.failRate ?? 0).toFixed(4)),
      failRatePct: pct(x.failRate ?? 0),
    }));

    const bySubject = (subjectAgg as any[]).map((x) => {
      const s = subjectMap.get(String(x.subjectId)) as any;
      return {
        ...x,
        subjectId: String(x.subjectId),
        subjectCode: s?.code ?? '',
        subjectName: s?.name ?? '',
        failRate: Number((x.failRate ?? 0).toFixed(4)),
        failRatePct: pct(x.failRate ?? 0),
      };
    });

    const byTeacher = (teacherAgg as any[]).map((x) => ({
      ...x,
      teacherId: String(x.teacherId),
      teacherName: (teacherMap.get(String(x.teacherId)) as any)?.name ?? '',
      failRate: Number((x.failRate ?? 0).toFixed(4)),
      failRatePct: pct(x.failRate ?? 0),
    }));

    const redFlags = (redFlagsRaw as any[]).map((x) => {
      const s = subjectMap.get(String(x.subjectId)) as any;
      return {
        ...x,
        subjectId: String(x.subjectId),
        subjectCode: s?.code ?? '',
        subjectName: s?.name ?? '',
        failRate: Number((x.failRate ?? 0).toFixed(4)),
        failRatePct: pct(x.failRate ?? 0),
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      periodId: String(periodObjId),
      periodName: (period as any)?.name ?? '',
      filters: {
        careerId: params.careerId ?? null,
        groupId: params.groupId ?? null,
        teacherId: params.teacherId ?? null,
        subjectId: params.subjectId ?? null,
      },
      config: { passThreshold, failRateMin, minCount, topN },
      summary,
      distribution,
      byGroup,
      bySubject,
      byTeacher,
      top: {
        groups: byGroup.slice(0, topN),
        subjects: bySubject.slice(0, topN),
        teachers: byTeacher.slice(0, topN),
      },
      redFlags,
    };
  }
}
