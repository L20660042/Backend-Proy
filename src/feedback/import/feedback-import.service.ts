import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parse } from 'csv-parse/sync';

import { Period, PeriodDocument } from '../../academic/periods/schemas/period.schema';
import { Career, CareerDocument } from '../../academic/careers/schemas/career.schema';
import { Group, GroupDocument } from '../../academic/groups/schemas/group.schema';
import { Subject, SubjectDocument } from '../../academic/subjects/schemas/subject.schema';
import { Teacher, TeacherDocument } from '../../academic/teachers/schemas/teacher.schema';
import { Student, StudentDocument } from '../../academic/students/schemas/student.schema';
import { ClassAssignment, ClassAssignmentDocument } from '../../academic/class-assignments/schemas/class-assignment.schema';

import { TeacherEvaluation, TeacherEvaluationDocument } from '../evaluations/schemas/teacher-evaluation.schema';
import { TeacherComplaint, TeacherComplaintDocument } from '../complaints/schemas/teacher-complaint.schema';

import { AiClientService } from '../ai/ai.client';
import { EVALUATION_ITEMS, EvaluationItemKey } from '../evaluations/evaluation-template';

type ImportError = { row: number; message: string; data?: any };
type ImportResult = {
  entity: 'evaluations' | 'complaints';
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
};

function norm(x: any) {
  return String(x ?? '').trim();
}
function normUpper(x: any) {
  return norm(x).toUpperCase();
}
function normalizeLooseKey(x: any) {
  return norm(x).toLowerCase().replace(/\s+/g, ' ');
}
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function parseCsv(file: Express.Multer.File) {
  const txt = file.buffer?.toString('utf8');
  if (!txt) throw new BadRequestException('CSV vacío o ilegible');
  return parse(txt, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as any[];
}
function pick(row: any, keys: string[]) {
  for (const k of keys) if (row?.[k] !== undefined) return row[k];
  const lower = new Map<string, any>();
  for (const k of Object.keys(row ?? {})) lower.set(k.toLowerCase(), row[k]);
  for (const k of keys) {
    const v = lower.get(k.toLowerCase());
    if (v !== undefined) return v;
  }
  return undefined;
}

function mapComplaintCategory(raw: any): TeacherComplaint['category'] {
  const s = normalizeLooseKey(raw);
  if (!s) return 'otro';
  if (s.includes('trato') || s.includes('respeto')) return 'trato';
  if (s.includes('puntual') || s.includes('tarde') || s.includes('impuntual')) return 'impuntualidad';
  if (s.includes('evaluacion') || s.includes('injust')) return 'evaluacion_injusta';
  if (s.includes('incumpl')) return 'incumplimiento';
  if (s.includes('acoso')) return 'acoso';
  return 'otro';
}

@Injectable()
export class FeedbackImportService {
  constructor(
    @InjectModel(Period.name) private readonly periodModel: Model<PeriodDocument>,
    @InjectModel(Career.name) private readonly careerModel: Model<CareerDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Subject.name) private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Teacher.name) private readonly teacherModel: Model<TeacherDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(ClassAssignment.name) private readonly caModel: Model<ClassAssignmentDocument>,

    @InjectModel(TeacherEvaluation.name) private readonly evalModel: Model<TeacherEvaluationDocument>,
    @InjectModel(TeacherComplaint.name) private readonly complaintModel: Model<TeacherComplaintDocument>,

    private readonly ai: AiClientService,
  ) {}

  private periodCache = new Map<string, PeriodDocument>();
  private careerCache = new Map<string, CareerDocument>();
  private subjectCache = new Map<string, SubjectDocument>();
  private teacherCache = new Map<string, TeacherDocument>();
  private groupCache = new Map<string, GroupDocument>(); // periodId|careerId|groupName

  private async getPeriodByName(periodName: string) {
    const key = normalizeLooseKey(periodName);
    if (!key) throw new BadRequestException('periodName requerido');
    const cached = this.periodCache.get(key);
    if (cached) return cached;

    const ci = await this.periodModel
      .findOne({ name: { $regex: new RegExp(`^${escapeRegex(norm(periodName))}$`, 'i') } })
      .exec();
    if (!ci) throw new BadRequestException(`No existe Period con name="${norm(periodName)}"`);
    this.periodCache.set(key, ci);
    return ci;
  }

  private async getCareerByCode(careerCode: string) {
    const key = normUpper(careerCode);
    if (!key) throw new BadRequestException('careerCode requerido');
    const cached = this.careerCache.get(key);
    if (cached) return cached;

    const c = await this.careerModel.findOne({ code: key }).exec();
    if (!c) throw new BadRequestException(`No existe Career con code="${key}"`);
    this.careerCache.set(key, c);
    return c;
  }

  private async getSubjectByCode(subjectCode: string) {
    const key = normUpper(subjectCode);
    if (!key) throw new BadRequestException('subjectCode requerido');
    const cached = this.subjectCache.get(key);
    if (cached) return cached;

    const s = await this.subjectModel.findOne({ code: key }).exec();
    if (!s) throw new BadRequestException(`No existe Subject con code="${key}"`);
    this.subjectCache.set(key, s);
    return s;
  }

  private async getTeacherByEmployeeNumber(employeeNumber: string) {
    const key = norm(employeeNumber);
    if (!key) throw new BadRequestException('teacherEmployeeNumber requerido');
    const cached = this.teacherCache.get(key);
    if (cached) return cached;

    const t = await this.teacherModel.findOne({ employeeNumber: key }).exec();
    if (!t) throw new BadRequestException(`No existe Teacher con employeeNumber="${key}"`);
    this.teacherCache.set(key, t);
    return t;
  }

  private async getGroup(periodId: Types.ObjectId, careerId: Types.ObjectId, groupName: string) {
    const gname = normUpper(groupName);
    if (!gname) throw new BadRequestException('groupName requerido');

    const key = `${String(periodId)}|${String(careerId)}|${gname}`;
    const cached = this.groupCache.get(key);
    if (cached) return cached;

    const g = await this.groupModel.findOne({ periodId, careerId, name: gname }).exec();
    if (!g) throw new BadRequestException(`No existe Group "${gname}" para ese periodo/carrera`);
    this.groupCache.set(key, g);
    return g;
  }

  private validateRatings(ratings: Record<string, number>) {
    if (!ratings || typeof ratings !== 'object') throw new BadRequestException('ratings requerido');

    const allowed = new Set<EvaluationItemKey>(EVALUATION_ITEMS.map((i) => i.key));

    for (const k of Object.keys(ratings)) {
      if (!allowed.has(k as EvaluationItemKey)) {
        throw new BadRequestException(`Item inválido en ratings: ${k}`);
      }
    }

    for (const item of EVALUATION_ITEMS) {
      const v = (ratings as any)[item.key];
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1 || n > 5) {
        throw new BadRequestException(`Rating inválido en ${item.key} (1..5)`);
      }
    }
  }

  // CSV Evaluations:
  // periodName,careerCode,groupName,subjectCode,teacherEmployeeNumber,studentControlNumber,clarity,punctuality,respect,planning,evaluation,comment
  async importEvaluations(file: Express.Multer.File, dryRun: boolean): Promise<ImportResult> {
    const rows = parseCsv(file);

    const result: ImportResult = {
      entity: 'evaluations',
      dryRun,
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 2;
      const row = rows[i];

      try {
        const periodName = norm(pick(row, ['periodName']));
        const careerCode = normUpper(pick(row, ['careerCode']));
        const groupName = normUpper(pick(row, ['groupName']));
        const subjectCode = normUpper(pick(row, ['subjectCode']));
        const teacherEmp = norm(pick(row, ['teacherEmployeeNumber', 'employeeNumber']));
        const studentCN = norm(pick(row, ['studentControlNumber', 'controlNumber']));
        const comment = norm(pick(row, ['comment', 'texto', 'observaciones']));

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!careerCode) throw new BadRequestException('careerCode requerido');
        if (!groupName) throw new BadRequestException('groupName requerido');
        if (!subjectCode) throw new BadRequestException('subjectCode requerido');
        if (!teacherEmp) throw new BadRequestException('teacherEmployeeNumber requerido');
        if (!studentCN) throw new BadRequestException('studentControlNumber requerido');

        const period = await this.getPeriodByName(periodName);
        const career = await this.getCareerByCode(careerCode);
        const group = await this.getGroup(period._id, career._id, groupName);
        const subject = await this.getSubjectByCode(subjectCode);
        const teacher = await this.getTeacherByEmployeeNumber(teacherEmp);

        const student = await this.studentModel.findOne({ controlNumber: studentCN }).exec();
        if (!student) throw new BadRequestException(`No existe Student con controlNumber="${studentCN}"`);

        const ratings: Record<string, number> = {
          clarity: Number(pick(row, ['clarity'])),
          punctuality: Number(pick(row, ['punctuality'])),
          respect: Number(pick(row, ['respect'])),
          planning: Number(pick(row, ['planning'])),
          evaluation: Number(pick(row, ['evaluation'])),
        };

        this.validateRatings(ratings);

        // Resolver carga (ClassAssignment) REAL
        const ca = await this.caModel
          .findOne({
            periodId: period._id,
            careerId: career._id,
            groupId: group._id,
            subjectId: subject._id,
            status: 'active',
          })
          .lean();

        if (!ca) throw new BadRequestException('No existe ClassAssignment (carga) para ese periodo/carrera/grupo/materia');

        if (String((ca as any).teacherId) !== String(teacher._id)) {
          throw new BadRequestException('teacherEmployeeNumber no coincide con el docente asignado a esa carga');
        }

        if (dryRun) {
          result.updated++;
          continue;
        }

        const filter = {
          periodId: period._id,
          classAssignmentId: (ca as any)._id,
          studentId: student._id,
        };

        const baseDoc: any = {
          periodId: period._id,
          classAssignmentId: (ca as any)._id,
          studentId: student._id,
          teacherId: (ca as any).teacherId,
          groupId: (ca as any).groupId,
          subjectId: (ca as any).subjectId,
          ratings,
          comment,
          status: 'submitted',
          analysis: null,
        };

        const upd = await this.evalModel.updateOne(filter, { $set: baseDoc }, { upsert: true }).exec();
        const created = (upd as any)?.upsertedCount ? true : false;
        if (created) result.created++;
        else result.updated++;

        // IA
        if (comment) {
          const analysis = await this.ai.analyzeText({
            text: comment,
            lang: 'es',
            tasks: ['sentiment', 'topics'],
          });
          if (analysis) {
            await this.evalModel.updateOne(filter, { $set: { analysis } }).exec();
          }
        }
      } catch (e: any) {
        result.failed++;
        result.errors.push({
          row: rowNo,
          message: e?.response?.message ?? e?.message ?? 'Error',
          data: row,
        });
      }
    }

    return result;
  }

  // CSV Complaints:
  // periodName,careerCode,groupName,subjectCode,teacherEmployeeNumber,studentControlNumber,category,description
  async importComplaints(file: Express.Multer.File, dryRun: boolean): Promise<ImportResult> {
    const rows = parseCsv(file);

    const result: ImportResult = {
      entity: 'complaints',
      dryRun,
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 2;
      const row = rows[i];

      try {
        const periodName = norm(pick(row, ['periodName']));
        const careerCode = normUpper(pick(row, ['careerCode']));
        const groupName = normUpper(pick(row, ['groupName']));
        const subjectCode = normUpper(pick(row, ['subjectCode']));
        const teacherEmp = norm(pick(row, ['teacherEmployeeNumber', 'employeeNumber']));
        const studentCN = norm(pick(row, ['studentControlNumber', 'controlNumber']));
        const categoryRaw = pick(row, ['category', 'categoria']);
        const description = norm(pick(row, ['description', 'detalle', 'texto']));

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!careerCode) throw new BadRequestException('careerCode requerido');
        if (!groupName) throw new BadRequestException('groupName requerido');
        if (!subjectCode) throw new BadRequestException('subjectCode requerido');
        if (!teacherEmp) throw new BadRequestException('teacherEmployeeNumber requerido');
        if (!studentCN) throw new BadRequestException('studentControlNumber requerido');
        if (!description) throw new BadRequestException('description requerido');

        const period = await this.getPeriodByName(periodName);
        const career = await this.getCareerByCode(careerCode);
        const group = await this.getGroup(period._id, career._id, groupName);
        const subject = await this.getSubjectByCode(subjectCode);
        const teacher = await this.getTeacherByEmployeeNumber(teacherEmp);

        const student = await this.studentModel.findOne({ controlNumber: studentCN }).exec();
        if (!student) throw new BadRequestException(`No existe Student con controlNumber="${studentCN}"`);

        const category = mapComplaintCategory(categoryRaw);

        // Resolver carga si existe (mejor data para dashboards)
        const ca = await this.caModel
          .findOne({
            periodId: period._id,
            careerId: career._id,
            groupId: group._id,
            subjectId: subject._id,
            status: 'active',
          })
          .lean();

        if (ca && String((ca as any).teacherId) !== String(teacher._id)) {
          throw new BadRequestException('teacherEmployeeNumber no coincide con el docente asignado a esa carga');
        }

        if (dryRun) {
          result.created++;
          continue;
        }

        const created = await this.complaintModel.create({
          periodId: period._id,
          studentId: student._id, // requerido por tu schema
          teacherId: teacher._id,
          classAssignmentId: ca ? (ca as any)._id : null,
          groupId: group._id,
          subjectId: subject._id,
          category,
          description,
          status: 'open',
          analysis: null,
        });

        const analysis = await this.ai.analyzeText({
          text: description,
          lang: 'es',
          tasks: ['sentiment', 'topics', 'summary'],
        });

        if (analysis) {
          await this.complaintModel.updateOne({ _id: created._id }, { $set: { analysis } }).exec();
        }

        result.created++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({
          row: rowNo,
          message: e?.response?.message ?? e?.message ?? 'Error',
          data: row,
        });
      }
    }

    return result;
  }

  // Reprocesar IA en registros sin analysis
  async processPendingAi(limit = 50) {
    const lim = Number(limit ?? 50);
    const realLimit = Number.isFinite(lim) ? lim : 50;

    let processed = 0;

    const evals = await this.evalModel
      .find({ analysis: null })
      .select({ comment: 1 })
      .limit(realLimit)
      .exec();

    for (const e of evals) {
      const text = String((e as any).comment ?? '').trim();
      if (!text) continue;

      const analysis = await this.ai.analyzeText({
        text,
        lang: 'es',
        tasks: ['sentiment', 'topics', 'summary'],
      });

      if (analysis) {
        await this.evalModel.updateOne({ _id: e._id }, { $set: { analysis } }).exec();
        processed++;
      }
    }

    const comps = await this.complaintModel
      .find({ analysis: null })
      .select({ description: 1 })
      .limit(realLimit)
      .exec();

    for (const c of comps) {
      const text = String((c as any).description ?? '').trim();
      if (!text) continue;

      const analysis = await this.ai.analyzeText({
        text,
        lang: 'es',
        tasks: ['sentiment', 'topics', 'summary'],
      });

      if (analysis) {
        await this.complaintModel.updateOne({ _id: c._id }, { $set: { analysis } }).exec();
        processed++;
      }
    }

    return { processed };
  }
}
