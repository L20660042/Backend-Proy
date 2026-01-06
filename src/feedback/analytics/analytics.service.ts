import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { TeacherEvaluation, TeacherEvaluationDocument } from '../evaluations/schemas/teacher-evaluation.schema';
import { TeacherComplaint, TeacherComplaintDocument } from '../complaints/schemas/teacher-complaint.schema';
import { EVALUATION_ITEMS } from '../evaluations/evaluation-template';
import { Teacher, TeacherDocument } from '../../academic/teachers/schemas/teacher.schema';

type Bucket = 'day' | 'week' | 'month';

function asObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new BadRequestException('periodId inválido');
  return new Types.ObjectId(id);
}

function optionalObjectId(id?: string, paramName = 'id') {
  if (!id) return undefined;
  if (!Types.ObjectId.isValid(id)) throw new BadRequestException(`${paramName} inválido`);
  return new Types.ObjectId(id);
}

function normSentimentLabel(x: any): 'positive' | 'neutral' | 'negative' | 'unknown' {
  const s = String(x ?? '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (['positive', 'positivo', 'pos', 'posi', 'p'].includes(s)) return 'positive';
  if (['negative', 'negativo', 'neg', 'n'].includes(s)) return 'negative';
  if (['neutral', 'neutro', 'neu'].includes(s)) return 'neutral';
  if (s.includes('pos')) return 'positive';
  if (s.includes('neg')) return 'negative';
  if (s.includes('neu')) return 'neutral';
  return 'unknown';
}

function bucketExpr(bucket: Bucket) {
  if (bucket === 'day') return { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  if (bucket === 'week') return { $dateToString: { format: '%G-W%V', date: '$createdAt' } }; // ISO week
  return { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(TeacherEvaluation.name) private readonly evalModel: Model<TeacherEvaluationDocument>,
    @InjectModel(TeacherComplaint.name) private readonly compModel: Model<TeacherComplaintDocument>,
    @InjectModel(Teacher.name) private readonly teacherModel: Model<TeacherDocument>,
  ) {}

  async overview(periodId: string) {
    if (!periodId) throw new BadRequestException('periodId requerido');

    
    const pid = asObjectId(periodId);

    const evals = await this.evalModel
      .find({ periodId: pid })
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

    const comps = await this.compModel
      .find({ periodId: pid })
      .select({ teacherId: 1, status: 1 })
      .populate('teacherId')
      .lean();

    for (const c of comps) {
      const tidRaw = (c as any).teacherId?._id ?? (c as any).teacherId;
      const tid = tidRaw ? String(tidRaw) : 'unassigned';
      if (!byTeacher[tid]) {
        byTeacher[tid] = {
          teacherId: tid,
          teacherName: tid === 'unassigned' ? 'Sin asignar' : ((c as any).teacherId?.name ?? ''),
          countEvaluations: 0,
          sums: Object.fromEntries(EVALUATION_ITEMS.map((i) => [i.key, 0])),
        };
      }
      byTeacher[tid].countComplaints = (byTeacher[tid].countComplaints ?? 0) + 1;
      byTeacher[tid].complaintsOpen = (byTeacher[tid].complaintsOpen ?? 0) + ((c as any).status === 'open' ? 1 : 0);
    }

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

    rows.sort((a: any, b: any) => {
      if (b.complaintsOpen !== a.complaintsOpen) return b.complaintsOpen - a.complaintsOpen;
      return (a.averages.clarity ?? 0) - (b.averages.clarity ?? 0);
    });

    const totals = {
      evaluations: evals.length,
      complaints: comps.length,
      complaintsWithTeacher: comps.filter((c: any) => !!(c?.teacherId?._id ?? c?.teacherId)).length,
      complaintsUnassigned: comps.filter((c: any) => !(c?.teacherId?._id ?? c?.teacherId)).length,
    };

    return { periodId, items: EVALUATION_ITEMS, teachers: rows, totals };
  }

  async aiDashboard(opts: {
    periodId: string;
    topN: number;
    bucket: Bucket;
    teacherId?: string;
    subjectId?: string;
    groupId?: string;
  }) {
    const { periodId, topN, bucket } = opts;
    if (!periodId) throw new BadRequestException('periodId requerido');

    const pid = asObjectId(periodId);

    const tid = optionalObjectId(opts.teacherId, 'teacherId');
    const sid = optionalObjectId(opts.subjectId, 'subjectId');
    const gid = optionalObjectId(opts.groupId, 'groupId');

    const evalBaseMatch: any = { periodId: pid };
    if (tid) evalBaseMatch.teacherId = tid;
    if (sid) evalBaseMatch.subjectId = sid;
    if (gid) evalBaseMatch.groupId = gid;

    const compBaseMatch: any = { periodId: pid };
    if (tid) compBaseMatch.teacherId = tid;
    if (sid) compBaseMatch.subjectId = sid;
    if (gid) compBaseMatch.groupId = gid;

    const evalSent = await this.evalModel.aggregate([
      { $match: { ...evalBaseMatch, 'analysis.sentiment.label': { $exists: true } } },
      {
        $project: {
          teacherId: 1,
          label: { $ifNull: ['$analysis.sentiment.label', ''] },
          createdAt: 1,
        },
      },
      {
        $group: {
          _id: { label: '$label' },
          count: { $sum: 1 },
        },
      },
    ]);

    const compSent = await this.compModel.aggregate([
      { $match: { ...compBaseMatch, 'analysis.sentiment.label': { $exists: true } } },
      {
        $project: {
          teacherId: 1,
          label: { $ifNull: ['$analysis.sentiment.label', ''] },
          createdAt: 1,
        },
      },
      {
        $group: {
          _id: { label: '$label' },
          count: { $sum: 1 },
        },
      },
    ]);

    const sentiment = { positive: 0, neutral: 0, negative: 0, unknown: 0 };
    for (const r of [...evalSent, ...compSent]) {
      const k = normSentimentLabel(r?._id?.label);
      (sentiment as any)[k] = ((sentiment as any)[k] ?? 0) + Number(r.count ?? 0);
    }

    const evalTopics = await this.evalModel.aggregate([
      { $match: { ...evalBaseMatch, 'analysis.topics': { $exists: true, $ne: [] } } },
      { $unwind: '$analysis.topics' },
      {
        $project: {
          label: { $toLower: { $ifNull: ['$analysis.topics.label', ''] } },
          score: { $ifNull: ['$analysis.topics.score', 1] },
        },
      },
      { $match: { label: { $ne: '' } } },
      {
        $group: {
          _id: '$label',
          count: { $sum: 1 },
          weight: { $sum: '$score' },
        },
      },
      { $sort: { count: -1, weight: -1 } },
      { $limit: Math.max(5, topN) },
    ]);

    const compTopics = await this.compModel.aggregate([
      { $match: { ...compBaseMatch, 'analysis.topics': { $exists: true, $ne: [] } } },
      { $unwind: '$analysis.topics' },
      {
        $project: {
          label: { $toLower: { $ifNull: ['$analysis.topics.label', ''] } },
          score: { $ifNull: ['$analysis.topics.score', 1] },
        },
      },
      { $match: { label: { $ne: '' } } },
      {
        $group: {
          _id: '$label',
          count: { $sum: 1 },
          weight: { $sum: '$score' },
        },
      },
      { $sort: { count: -1, weight: -1 } },
      { $limit: Math.max(5, topN) },
    ]);

    const topicMap = new Map<string, { label: string; count: number; weight: number }>();
    for (const r of [...evalTopics, ...compTopics]) {
      const label = String(r._id ?? '').trim().toLowerCase();
      if (!label) continue;
      const prev = topicMap.get(label) ?? { label, count: 0, weight: 0 };
      prev.count += Number(r.count ?? 0);
      prev.weight += Number(r.weight ?? 0);
      topicMap.set(label, prev);
    }

    const topTopics = Array.from(topicMap.values())
      .sort((a, b) => b.count - a.count || b.weight - a.weight)
      .slice(0, topN);

    const evalTrend = await this.evalModel.aggregate([
      { $match: { ...evalBaseMatch, 'analysis.sentiment.label': { $exists: true } } },
      {
        $project: {
          bucket: bucketExpr(bucket),
          label: { $ifNull: ['$analysis.sentiment.label', ''] },
        },
      },
      {
        $group: {
          _id: { bucket: '$bucket', label: '$label' },
          count: { $sum: 1 },
        },
      },
    ]);

    const compTrend = await this.compModel.aggregate([
      { $match: { ...compBaseMatch, 'analysis.sentiment.label': { $exists: true } } },
      {
        $project: {
          bucket: bucketExpr(bucket),
          label: { $ifNull: ['$analysis.sentiment.label', ''] },
        },
      },
      {
        $group: {
          _id: { bucket: '$bucket', label: '$label' },
          count: { $sum: 1 },
        },
      },
    ]);

    const bucketMap = new Map<string, { bucket: string; positive: number; neutral: number; negative: number; unknown: number }>();

    for (const r of [...evalTrend, ...compTrend]) {
      const b = String(r?._id?.bucket ?? '');
      const lab = normSentimentLabel(r?._id?.label);
      if (!b) continue;
      const prev =
        bucketMap.get(b) ?? { bucket: b, positive: 0, neutral: 0, negative: 0, unknown: 0 };
      (prev as any)[lab] = ((prev as any)[lab] ?? 0) + Number(r.count ?? 0);
      bucketMap.set(b, prev);
    }

    const sentimentTrend = Array.from(bucketMap.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));

    
    const evalTeacherMatch: any = { ...evalBaseMatch, 'analysis.sentiment.label': { $exists: true } };
    if (!evalTeacherMatch.teacherId) evalTeacherMatch.teacherId = { $ne: null };

    const evalByTeacher = await this.evalModel.aggregate([
      { $match: evalTeacherMatch },
      { $project: { teacherId: 1, label: { $ifNull: ['$analysis.sentiment.label', ''] } } },
      { $group: { _id: { teacherId: '$teacherId', label: '$label' }, count: { $sum: 1 } } },
    ]);

    const compTeacherMatch: any = { ...compBaseMatch, 'analysis.sentiment.label': { $exists: true } };
    if (!compTeacherMatch.teacherId) compTeacherMatch.teacherId = { $ne: null };

    const compByTeacher = await this.compModel.aggregate([
      { $match: compTeacherMatch },
      { $project: { teacherId: 1, label: { $ifNull: ['$analysis.sentiment.label', ''] } } },
      { $group: { _id: { teacherId: '$teacherId', label: '$label' }, count: { $sum: 1 } } },
    ]);

    const tMap = new Map<string, { teacherId: string; pos: number; neu: number; neg: number; unk: number; total: number }>();
    for (const r of [...evalByTeacher, ...compByTeacher]) {
      const tid = String(r?._id?.teacherId ?? '');
      if (!tid) continue;
      const prev = tMap.get(tid) ?? { teacherId: tid, pos: 0, neu: 0, neg: 0, unk: 0, total: 0 };
      const k = normSentimentLabel(r?._id?.label);
      if (k === 'positive') prev.pos += Number(r.count ?? 0);
      else if (k === 'neutral') prev.neu += Number(r.count ?? 0);
      else if (k === 'negative') prev.neg += Number(r.count ?? 0);
      else prev.unk += Number(r.count ?? 0);
      prev.total += Number(r.count ?? 0);
      tMap.set(tid, prev);
    }

    const teacherIds = Array.from(tMap.keys()).filter((x) => Types.ObjectId.isValid(x)).map((x) => new Types.ObjectId(x));
    const teachers = await this.teacherModel.find({ _id: { $in: teacherIds } }).select({ name: 1 }).lean();
    const teacherNameMap = new Map<string, string>(teachers.map((t: any) => [String(t._id), String(t.name ?? '')]));

    const topTeachersByNegativity = Array.from(tMap.values())
      .map((t) => {
        const negRate = t.total ? t.neg / t.total : 0;
        return {
          teacherId: t.teacherId,
          teacherName: teacherNameMap.get(t.teacherId) ?? '',
          total: t.total,
          negative: t.neg,
          neutral: t.neu,
          positive: t.pos,
          negativeRate: Math.round(negRate * 1000) / 10, // %
        };
      })
      .filter((x) => x.total >= 3) // evita ruido
      .sort((a, b) => b.negativeRate - a.negativeRate || b.total - a.total)
      .slice(0, 12);

    return {
      periodId,
      bucket,
      filters: {
        teacherId: tid ? String(tid) : undefined,
        subjectId: sid ? String(sid) : undefined,
        groupId: gid ? String(gid) : undefined,
      },
      sentiment,
      topTopics,
      sentimentTrend,
      topTeachersByNegativity,
    };
  }
}
