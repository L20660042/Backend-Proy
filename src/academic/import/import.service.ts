import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parse } from 'csv-parse/sync';

import { Period, PeriodDocument } from '../periods/schemas/period.schema';
import { Career, CareerDocument } from '../careers/schemas/career.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherDocument } from '../teachers/schemas/teacher.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { ClassAssignment, ClassAssignmentDocument } from '../class-assignments/schemas/class-assignment.schema';
import { ScheduleBlock, ScheduleBlockDocument } from '../schedule-blocks/schemas/schedule-block.schema';

import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';
import { ActivityEnrollment, ActivityEnrollmentDocument } from '../activity-enrollments/schemas/activity-enrollment.schema';

import { StudentsService } from '../students/students.service';
import { ClassAssignmentsService } from '../class-assignments/class-assignments.service';
import { ScheduleBlocksService } from '../schedule-blocks/schedule-blocks.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { ActivityEnrollmentsService } from '../activity-enrollments/activity-enrollments.service';

type DeliveryMode = 'presencial' | 'semipresencial' | 'asincrono';
type EnrollmentStatus = 'active' | 'inactive' | 'suspended';

type ImportEntity =
  | 'periods'
  | 'careers'
  | 'subjects'
  | 'teachers'
  | 'groups'
  | 'students'
  | 'enrollments'
  | 'class-assignments'
  | 'schedule-blocks'
  | 'activities'
  | 'activity-enrollments';

type ImportError = {
  row: number; // 2 = primera fila de datos (porque columns=true)
  message: string;
  data?: any;
};

type ImportResult = {
  entity: ImportEntity;
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
};

function norm(v: any) {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}
function normUpper(v: any) {
  const s = norm(v);
  return s ? s.toUpperCase() : '';
}
function buildLowerKeyMap(row: any) {
  const m = new Map<string, any>();
  if (!row || typeof row !== 'object') return m;
  for (const k of Object.keys(row)) m.set(String(k).toLowerCase(), row[k]);
  return m;
}
function pick(row: any, keys: string[]) {
  const direct = keys.find((k) => row?.[k] !== undefined);
  if (direct) return row[direct];

  const m = buildLowerKeyMap(row);
  for (const k of keys) {
    const v = m.get(k.toLowerCase());
    if (v !== undefined) return v;
  }
  return undefined;
}

function parseCsv(file: Express.Multer.File) {
  const txt = file.buffer?.toString('utf8');
  if (!txt) throw new BadRequestException('CSV vacío o ilegible');

  // soporta BOM
  const clean = txt.replace(/^\uFEFF/, '');

  const rows = parse(clean, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  if (!Array.isArray(rows)) return [];
  return rows;
}

function parseDateSafe(raw: any, fieldName: string) {
  const s = norm(raw);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${fieldName} inválido: "${s}"`);
  return d;
}

function normalizeStatus(raw: any): EnrollmentStatus {
  const s = norm(raw).toLowerCase();
  if (!s) return 'active';
  if (['active', 'activo'].includes(s)) return 'active';
  if (['inactive', 'inactivo'].includes(s)) return 'inactive';
  if (['suspended', 'suspendido'].includes(s)) return 'suspended';
  return 'active';
}

function normalizeDeliveryMode(raw: any): DeliveryMode {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  if (!s) return 'presencial';

  // directos
  if (s === 'presencial') return 'presencial';
  if (s === 'semipresencial' || s === 'semi-presencial' || s === 'semi') return 'semipresencial';
  if (s === 'asincrono' || s === 'asíncrono' || s === 'async') return 'asincrono';

  // tolerancias comunes (tu enum NO tiene virtual/hibrido, por eso se mapean)
  if (['virtual', 'enlinea', 'enlínea', 'enlinea', 'online'].includes(s)) return 'asincrono';
  if (['hibrido', 'híbrido', 'mixto', 'blended'].includes(s)) return 'semipresencial';

  return 'presencial';
}

function normalizeDayOfWeek(raw: any): number {
  const s = norm(raw).toLowerCase();
  if (!s) throw new BadRequestException('dayOfWeek requerido');

  const n = Number(s);
  if (!Number.isNaN(n)) {
    if (n < 1 || n > 7) throw new BadRequestException('dayOfWeek debe ser 1..7');
    return n;
  }

  const map: Record<string, number> = {
    lun: 1,
    lunes: 1,
    mar: 2,
    martes: 2,
    mie: 3,
    mié: 3,
    miercoles: 3,
    miércoles: 3,
    jue: 4,
    jueves: 4,
    vie: 5,
    viernes: 5,
    sab: 6,
    sáb: 6,
    sabado: 6,
    sábado: 6,
    dom: 7,
    domingo: 7,
  };
  const k = s.replace(/\./g, '');
  const v = map[k];
  if (!v) throw new BadRequestException(`dayOfWeek inválido: "${raw}"`);
  return v;
}

function normalizeHHMM(raw: any, field: string) {
  const s = norm(raw);
  if (!s) throw new BadRequestException(`${field} requerido`);
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new BadRequestException(`${field} inválido (HH:MM): "${s}"`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) throw new BadRequestException(`${field} inválido: "${s}"`);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

@Injectable()
export class ImportService {
  private periodCache = new Map<string, PeriodDocument>();
  private careerCache = new Map<string, CareerDocument>();
  private groupCache = new Map<string, GroupDocument>();
  private subjectCache = new Map<string, SubjectDocument>();
  private teacherCache = new Map<string, TeacherDocument>();

  constructor(
    @InjectModel(Period.name) private readonly periodModel: Model<PeriodDocument>,
    @InjectModel(Career.name) private readonly careerModel: Model<CareerDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Subject.name) private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Teacher.name) private readonly teacherModel: Model<TeacherDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(ClassAssignment.name) private readonly caModel: Model<ClassAssignmentDocument>,
    @InjectModel(ScheduleBlock.name) private readonly sbModel: Model<ScheduleBlockDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(ActivityEnrollment.name) private readonly activityEnrollmentModel: Model<ActivityEnrollmentDocument>,

    private readonly studentsService: StudentsService,
    private readonly classAssignmentsService: ClassAssignmentsService,
    private readonly scheduleBlocksService: ScheduleBlocksService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly activityEnrollmentsService: ActivityEnrollmentsService,
  ) {}

  // -------------------------
  // Helpers de lookup
  private async getPeriodByName(periodName: string) {
    const key = norm(periodName);
    if (!key) throw new BadRequestException('periodName requerido');
    const cached = this.periodCache.get(key);
    if (cached) return cached;

    const direct = await this.periodModel.findOne({ name: key }).exec();
    if (direct) {
      this.periodCache.set(key, direct as any);
      return direct as any;
    }

    // tolera variantes: "ENE-JUN 2026" vs "Ene-Jun 2026"
    const safe = key.replace(/\s+/g, ' ').trim();
    const alt = await this.periodModel.findOne({ name: new RegExp(`^${safe}$`, 'i') }).exec();
    if (alt) {
      this.periodCache.set(key, alt as any);
      return alt as any;
    }

    const compact = safe.replace(/[-–—]/g, '').toLowerCase();
    const all = await this.periodModel.find({}).exec();
    const found = all.find((p) => String(p.name).replace(/[-–—]/g, '').toLowerCase() === compact);
    if (found) {
      this.periodCache.set(key, found as any);
      return found as any;
    }

    throw new BadRequestException(`No existe Period con name="${key}"`);
  }

  private async getCareerByCode(careerCode: string) {
    const code = normUpper(careerCode);
    if (!code) throw new BadRequestException('careerCode requerido');

    const cached = this.careerCache.get(code);
    if (cached) return cached;

    const doc = await this.careerModel.findOne({ code }).exec();
    if (!doc) throw new BadRequestException(`No existe Career con code="${code}"`);
    this.careerCache.set(code, doc as any);
    return doc as any;
  }

  private async getGroup(periodName: string, careerCode: string, groupName: string) {
    const p = await this.getPeriodByName(periodName);
    const c = await this.getCareerByCode(careerCode);

    const name = norm(groupName);
    if (!name) throw new BadRequestException('groupName requerido');

    const key = `${String(p._id)}|${String(c._id)}|${name}`;
    const cached = this.groupCache.get(key);
    if (cached) return cached;

    const doc = await this.groupModel.findOne({ periodId: p._id, careerId: c._id, name }).exec();
    if (!doc) throw new BadRequestException(`No existe Group "${name}" para career="${careerCode}" period="${periodName}"`);
    this.groupCache.set(key, doc as any);
    return doc as any;
  }

  private async getSubjectByCode(code: string) {
    const c = normUpper(code);
    if (!c) throw new BadRequestException('subjectCode requerido');

    const cached = this.subjectCache.get(c);
    if (cached) return cached;

    const doc = await this.subjectModel.findOne({ code: c }).exec();
    if (!doc) throw new BadRequestException(`No existe Subject con code="${c}"`);
    this.subjectCache.set(c, doc as any);
    return doc as any;
  }

  private async getTeacherByEmployeeNumber(employeeNumber: string) {
    const n = norm(employeeNumber);
    if (!n) throw new BadRequestException('teacherEmployeeNumber requerido');

    const cached = this.teacherCache.get(n);
    if (cached) return cached;

    const doc = await this.teacherModel.findOne({ employeeNumber: n }).exec();
    if (!doc) throw new BadRequestException(`No existe Teacher con employeeNumber="${n}"`);
    this.teacherCache.set(n, doc as any);
    return doc as any;
  }
async importPeriods(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);
    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const name = norm(pick(row, ['name', 'periodName', 'period']));
        const startDate = parseDateSafe(pick(row, ['startDate', 'start', 'inicio', 'fechaInicio']), 'startDate');
        const endDate = parseDateSafe(pick(row, ['endDate', 'end', 'fin', 'fechaFin']), 'endDate');
        const isActiveRaw = pick(row, ['isActive', 'active', 'activo']);
        const isActive =
          String(isActiveRaw ?? '')
            .trim()
            .toLowerCase() === 'true' ||
          String(isActiveRaw ?? '')
            .trim()
            .toLowerCase() === '1' ||
          String(isActiveRaw ?? '')
            .trim()
            .toLowerCase() === 'si' ||
          String(isActiveRaw ?? '')
            .trim()
            .toLowerCase() === 'sí';

        if (!name) throw new BadRequestException('name requerido');
        if (!startDate) throw new BadRequestException('startDate requerido');
        if (!endDate) throw new BadRequestException('endDate requerido');

        const existing = await this.periodModel.findOne({ name }).exec();
        if (!existing) {
          created++;
          if (!dryRun) {
            await this.periodModel.create({ name, startDate, endDate, isActive });
          }
          continue;
        }

        const needsUpdate =
          String(existing.name) !== name ||
          String(existing.startDate?.toISOString?.() ?? '') !== String(startDate.toISOString()) ||
          String(existing.endDate?.toISOString?.() ?? '') !== String(endDate.toISOString()) ||
          Boolean(existing.isActive) !== Boolean(isActive);

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.periodModel
            .updateOne({ _id: existing._id }, { $set: { startDate, endDate, isActive } })
            .exec();
        }
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return { entity: 'periods', dryRun, total: rows.length, created, updated, skipped, failed, errors };
  }
  async importCareers(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);
    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const code = normUpper(pick(row, ['code', 'careerCode', 'career']));
        const name = norm(pick(row, ['name', 'careerName']));
        const status = norm(pick(row, ['status'])) || 'active';

        if (!code) throw new BadRequestException('code requerido');
        if (!name) throw new BadRequestException('name requerido');

        const existing = await this.careerModel.findOne({ code }).exec();
        if (!existing) {
          created++;
          if (!dryRun) {
            await this.careerModel.create({
              code,
              name,
              status: status === 'inactive' ? 'inactive' : 'active',
            } as any);
          }
          continue;
        }

        const needsUpdate =
          String(existing.name) !== name || String((existing as any).status ?? 'active') !== String(status);

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.careerModel
            .updateOne(
              { _id: existing._id },
              { $set: { name, status: status === 'inactive' ? 'inactive' : 'active' } },
            )
            .exec();
        }
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return { entity: 'careers', dryRun, total: rows.length, created, updated, skipped, failed, errors };
  }
  async importTeachers(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);
    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const employeeNumber = norm(pick(row, ['employeeNumber', 'teacherEmployeeNumber']));
        const name = norm(pick(row, ['name', 'teacherName']));
        const email = norm(pick(row, ['email']));
        const status = norm(pick(row, ['status'])) || 'active';

        if (!employeeNumber) throw new BadRequestException('employeeNumber requerido');
        if (!name) throw new BadRequestException('name requerido');
        if (!email) throw new BadRequestException('email requerido');

        const existing = await this.teacherModel.findOne({ employeeNumber }).exec();
        if (!existing) {
          created++;
          if (!dryRun) {
            await this.teacherModel.create({
              employeeNumber,
              name,
              email,
              status: status === 'inactive' ? 'inactive' : 'active',
            } as any);
          }
          continue;
        }

        const needsUpdate =
          String(existing.name) !== name ||
          String((existing as any).email ?? '') !== email ||
          String((existing as any).status ?? 'active') !== status;

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.teacherModel
            .updateOne(
              { _id: existing._id },
              { $set: { name, email, status: status === 'inactive' ? 'inactive' : 'active' } },
            )
            .exec();
        }
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return { entity: 'teachers', dryRun, total: rows.length, created, updated, skipped, failed, errors };
  }
  async importSubjects(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);
    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const code = normUpper(pick(row, ['code', 'subjectCode']));
        const name = norm(pick(row, ['name', 'subjectName']));
        const creditsRaw = pick(row, ['credits', 'creditos']);
        const unitsRaw = pick(row, ['units', 'unidades', 'unitCount']);
        const status = norm(pick(row, ['status'])) || 'active';

        if (!code) throw new BadRequestException('code requerido');
        if (!name) throw new BadRequestException('name requerido');

        const credits =
          creditsRaw === undefined || creditsRaw === null || String(creditsRaw).trim() === ''
            ? null
            : Number(String(creditsRaw).trim());
        const units =
          unitsRaw === undefined || unitsRaw === null || String(unitsRaw).trim() === ''
            ? null
            : Number(String(unitsRaw).trim());

        if (credits !== null && (Number.isNaN(credits) || credits < 0)) throw new BadRequestException('credits inválido');
        if (units !== null && (Number.isNaN(units) || units < 1 || units > 10)) throw new BadRequestException('units inválido');

        const existing = await this.subjectModel.findOne({ code }).exec();
        if (!existing) {
          created++;
          if (!dryRun) {
            await this.subjectModel.create({
              code,
              name,
              credits: credits ?? undefined,
              units: units ?? undefined,
              status: status === 'inactive' ? 'inactive' : 'active',
            } as any);
          }
          continue;
        }

        const needsUpdate =
          String(existing.name) !== name ||
          Number((existing as any).credits ?? null) !== Number(credits ?? null) ||
          Number((existing as any).units ?? null) !== Number(units ?? null) ||
          String((existing as any).status ?? 'active') !== status;

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.subjectModel
            .updateOne(
              { _id: existing._id },
              {
                $set: {
                  name,
                  credits: credits ?? undefined,
                  units: units ?? undefined,
                  status: status === 'inactive' ? 'inactive' : 'active',
                },
              },
            )
            .exec();
        }
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return { entity: 'subjects', dryRun, total: rows.length, created, updated, skipped, failed, errors };
  }
  async importGroups(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);
    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const periodName = norm(pick(row, ['periodName', 'period']));
        const careerCode = normUpper(pick(row, ['careerCode', 'career']));
        const groupName = norm(pick(row, ['groupName', 'name', 'group']));
        const semesterRaw = pick(row, ['semester', 'semestre']);
        const semester = Number(String(semesterRaw ?? '').trim());

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!careerCode) throw new BadRequestException('careerCode requerido');
        if (!groupName) throw new BadRequestException('groupName requerido');
        if (!semesterRaw || Number.isNaN(semester) || semester < 1) throw new BadRequestException('semester inválido');

        const period = await this.getPeriodByName(periodName);
        const career = await this.getCareerByCode(careerCode);

        const existing = await this.groupModel.findOne({ periodId: period._id, careerId: career._id, name: groupName }).exec();
        if (!existing) {
          created++;
          if (!dryRun) {
            await this.groupModel.create({
              periodId: period._id,
              careerId: career._id,
              name: groupName,
              semester,
            } as any);
          }
          continue;
        }

        const needsUpdate = Number((existing as any).semester ?? null) !== Number(semester);
        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.groupModel.updateOne({ _id: existing._id }, { $set: { semester } }).exec();
        }
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return { entity: 'groups', dryRun, total: rows.length, created, updated, skipped, failed, errors };
  }
  async importStudents(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);

    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const controlNumber = norm(pick(row, ['controlNumber', 'noControl', 'nocontrol']));
        const firstName = norm(pick(row, ['firstName', 'nombre']));
        const lastName = norm(pick(row, ['lastName', 'apellidos']));
        const careerCode = normUpper(pick(row, ['careerCode', 'career']));
        const semesterRaw = pick(row, ['semester', 'semestre']);
        const semester = semesterRaw ? Number(String(semesterRaw).trim()) : null;
        const email = norm(pick(row, ['email']));
        const status = norm(pick(row, ['status'])) || 'active';

        if (!controlNumber) throw new BadRequestException('controlNumber requerido');
        if (!firstName) throw new BadRequestException('firstName requerido');
        if (!lastName) throw new BadRequestException('lastName requerido');

        // valida carrera si viene
        if (careerCode) await this.getCareerByCode(careerCode);

        if (semester !== null && (Number.isNaN(semester) || semester < 1)) throw new BadRequestException('semester inválido');

        // upsert usando StudentsService (para conservar tu lógica de activación/registro)
        const existing = await this.studentModel.findOne({ controlNumber }).exec();

        if (!existing) {
          created++;
          if (!dryRun) {
            await this.studentsService.create({
              controlNumber,
              firstName,
              lastName,
              careerCode: careerCode || undefined,
              semester: semester ?? undefined,
              email: email || undefined,
              status: status as any,
            } as any);
          }
          continue;
        }

        const needsUpdate =
          String((existing as any).firstName ?? '') !== firstName ||
          String((existing as any).lastName ?? '') !== lastName ||
          String((existing as any).careerCode ?? '') !== String(careerCode ?? '') ||
          Number((existing as any).semester ?? null) !== Number(semester ?? null) ||
          String((existing as any).email ?? '') !== String(email ?? '') ||
          String((existing as any).status ?? 'active') !== String(status);

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.studentsService.update(String((existing as any)._id), {
            firstName,
            lastName,
            careerCode: careerCode || undefined,
            semester: semester ?? undefined,
            email: email || undefined,
            status: status as any,
          } as any);
        }
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return {
      entity: 'students',
      dryRun,
      total: rows.length,
      created,
      updated,
      skipped,
      failed,
      errors,
    };
  }
async importEnrollments(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);

    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const periodName = norm(pick(row, ['periodName']));
        const studentControlNumber = norm(pick(row, ['studentControlNumber', 'controlNumber', 'noControl', 'nocontrol']));
        const careerCode = normUpper(pick(row, ['careerCode']));
        const groupName = norm(pick(row, ['groupName', 'group']));
        const status = normalizeStatus(pick(row, ['status']));

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!studentControlNumber) throw new BadRequestException('studentControlNumber requerido');
        if (!careerCode) throw new BadRequestException('careerCode requerido');
        if (!groupName) throw new BadRequestException('groupName requerido');

        const period = await this.getPeriodByName(periodName);
        await this.getCareerByCode(careerCode); // valida carrera
        const group = await this.getGroup(periodName, careerCode, groupName);

        const student = await this.studentModel.findOne({ controlNumber: studentControlNumber }).exec();
        if (!student) throw new BadRequestException(`No existe Student con controlNumber="${studentControlNumber}"`);

        // Dry-run: solo validar referencias
        if (dryRun) {
          skipped++;
          continue;
        }

        // antes / después para saber si cambió algo
        const before = await this.enrollmentsService.list({
          periodId: String(period._id),
          studentId: String((student as any)._id),
        });

        await this.enrollmentsService.create({
          periodId: String(period._id),
          studentId: String((student as any)._id),
          groupId: String((group as any)._id),
          status,
        } as any);

        const after = await this.enrollmentsService.list({
          periodId: String(period._id),
          studentId: String((student as any)._id),
        });

        if ((before?.length ?? 0) === 0 && (after?.length ?? 0) > 0) created++;
        else updated++;
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return {
      entity: 'enrollments',
      dryRun,
      total: rows.length,
      created,
      updated,
      skipped,
      failed,
      errors,
    };
  }
 async importClassAssignments(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);

    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const periodName = norm(pick(row, ['periodName', 'period']));
        const careerCode = normUpper(pick(row, ['careerCode', 'career']));
        const groupName = norm(pick(row, ['groupName', 'group']));
        const subjectCode = normUpper(pick(row, ['subjectCode', 'code']));
        const teacherEmployeeNumber = norm(pick(row, ['teacherEmployeeNumber', 'employeeNumber']));
        const status = norm(pick(row, ['status'])) || 'active';

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!careerCode) throw new BadRequestException('careerCode requerido');
        if (!groupName) throw new BadRequestException('groupName requerido');
        if (!subjectCode) throw new BadRequestException('subjectCode requerido');
        if (!teacherEmployeeNumber) throw new BadRequestException('teacherEmployeeNumber requerido');

        const period = await this.getPeriodByName(periodName);
        const group = await this.getGroup(periodName, careerCode, groupName);
        const subject = await this.getSubjectByCode(subjectCode);
        const teacher = await this.getTeacherByEmployeeNumber(teacherEmployeeNumber);

        // Upsert por (period + group + subject)
        const existing = await this.caModel
          .findOne({
            periodId: period._id,
            groupId: group._id,
            subjectId: subject._id,
          })
          .exec();

        if (!existing) {
          created++;
          if (!dryRun) {
            await this.classAssignmentsService.create({
              periodId: String(period._id),
              careerId: String((group as any).careerId),
              groupId: String(group._id),
              subjectId: String(subject._id),
              teacherId: String(teacher._id),
              status: status as any,
            });
          }
          continue;
        }

        const needsUpdate =
          String((existing as any).teacherId ?? '') !== String(teacher._id) ||
          String((existing as any).status ?? 'active') !== String(status);

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.classAssignmentsService.update(String((existing as any)._id), {
            teacherId: String(teacher._id),
            status: status as any,
          } as any);
        }
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return {
      entity: 'class-assignments',
      dryRun,
      total: rows.length,
      created,
      updated,
      skipped,
      failed,
      errors,
    };
  }
  async importActivities(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);

    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const periodName = norm(pick(row, ['periodName', 'period']));
        const name = norm(pick(row, ['name', 'activityName', 'actividad']));
        const type = norm(pick(row, ['type', 'activityType', 'tipo'])) || 'otro';
        const responsibleName = norm(pick(row, ['responsibleName', 'responsable', 'responsible'])) || null;
        const capacityRaw = pick(row, ['capacity', 'cupo']);
        const capacity =
          capacityRaw === undefined || capacityRaw === null || String(capacityRaw).trim() === ''
            ? null
            : Number(String(capacityRaw).trim());
        const status = norm(pick(row, ['status'])) || 'active';

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!name) throw new BadRequestException('name requerido');

        if (capacity !== null && (Number.isNaN(capacity) || capacity < 0)) {
          throw new BadRequestException('capacity inválido');
        }

        const period = await this.getPeriodByName(periodName);

        // Upsert por (periodId + name)
        const existing = await this.activityModel.findOne({ periodId: period._id, name }).exec();

        if (!existing) {
          created++;
          if (!dryRun) {
            await this.activityModel.create({
              periodId: period._id,
              name,
              type,
              responsibleName,
              capacity,
              status: status === 'inactive' ? 'inactive' : 'active',
            } as any);
          }
          continue;
        }

        const needsUpdate =
          String((existing as any).type ?? '') !== String(type ?? '') ||
          String((existing as any).responsibleName ?? '') !== String(responsibleName ?? '') ||
          Number((existing as any).capacity ?? null) !== Number(capacity ?? null) ||
          String((existing as any).status ?? 'active') !== String(status);

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.activityModel
            .updateOne(
              { _id: (existing as any)._id },
              {
                $set: {
                  type,
                  responsibleName,
                  capacity,
                  status: status === 'inactive' ? 'inactive' : 'active',
                },
              },
            )
            .exec();
        }
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return {
      entity: 'activities',
      dryRun,
      total: rows.length,
      created,
      updated,
      skipped,
      failed,
      errors,
    };
  }
 async importActivityEnrollments(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);

    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const periodName = norm(pick(row, ['periodName', 'period']));
        const studentControlNumber = norm(pick(row, ['studentControlNumber', 'controlNumber', 'noControl', 'nocontrol']));
        const activityName = norm(pick(row, ['activityName', 'name', 'actividad']));
        const status = norm(pick(row, ['status'])) || 'active';

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!studentControlNumber) throw new BadRequestException('studentControlNumber requerido');
        if (!activityName) throw new BadRequestException('activityName requerido');

        const period = await this.getPeriodByName(periodName);

        const student = await this.studentModel.findOne({ controlNumber: studentControlNumber }).exec();
        if (!student) throw new BadRequestException(`No existe Student con controlNumber="${studentControlNumber}"`);

        const activity = await this.activityModel.findOne({ periodId: period._id, name: activityName }).exec();
        if (!activity) {
          throw new BadRequestException(`No existe Activity con name="${activityName}" en el periodo "${periodName}"`);
        }

        // Dry-run: solo validar referencias
        if (dryRun) {
          skipped++;
          continue;
        }

        const existing = await this.activityEnrollmentModel
          .findOne({
            periodId: period._id,
            studentId: (student as any)._id,
            activityId: (activity as any)._id,
          })
          .exec();

        const targetStatus = status === 'inactive' ? 'inactive' : 'active';

        if (!existing) {
          created++;
          await this.activityEnrollmentsService.create({
            periodId: String((period as any)._id),
            studentId: String((student as any)._id),
            activityId: String((activity as any)._id),
            status: targetStatus as any,
          });
          continue;
        }

        if (String((existing as any).status ?? 'active') === targetStatus) {
          skipped++;
          continue;
        }

        // Reactivar requiere validar choques
        if (targetStatus === 'active') {
          await this.activityEnrollmentsService.validateStudentScheduleConflictsForActivity({
            periodId: String((period as any)._id),
            studentId: String((student as any)._id),
            activityId: String((activity as any)._id),
          } as any);
        }

        updated++;
        await this.activityEnrollmentModel.updateOne({ _id: (existing as any)._id }, { $set: { status: targetStatus } }).exec();
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return {
      entity: 'activity-enrollments',
      dryRun,
      total: rows.length,
      created,
      updated,
      skipped,
      failed,
      errors,
    };
  }

   async importScheduleBlocks(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
    const rows = parseCsv(file);

    const errors: ImportError[] = [];
    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const periodName = norm(pick(row, ['periodName', 'period']));
        const type = norm(pick(row, ['type'])) || 'class';
        const deliveryMode = normalizeDeliveryMode(pick(row, ['deliveryMode', 'mode', 'modalidad']));
        const dayOfWeek = normalizeDayOfWeek(pick(row, ['dayOfWeek', 'day', 'dia']));
        const startTime = normalizeHHMM(pick(row, ['startTime', 'start']), 'startTime');
        const endTime = normalizeHHMM(pick(row, ['endTime', 'end']), 'endTime');
        const room = norm(pick(row, ['room', 'aula'])) || null;

        const careerCode = normUpper(pick(row, ['careerCode', 'career']));
        const groupName = norm(pick(row, ['groupName', 'group']));
        const subjectCode = normUpper(pick(row, ['subjectCode', 'code']));
        const teacherEmployeeNumber = norm(pick(row, ['teacherEmployeeNumber', 'employeeNumber']));
        const activityName = norm(pick(row, ['activityName', 'actividad', 'name']));

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!startTime) throw new BadRequestException('startTime requerido');
        if (!endTime) throw new BadRequestException('endTime requerido');

        const period = await this.getPeriodByName(periodName);

        let group: any = null;
        let subject: any = null;
        let teacher: any = null;
        let activity: any = null;

        if (type === 'extracurricular') {
          if (!activityName) throw new BadRequestException('activityName requerido para type=extracurricular');
          activity = await this.activityModel.findOne({ periodId: period._id, name: activityName }).exec();
          if (!activity) throw new BadRequestException(`No existe Activity con name="${activityName}" en el periodo "${periodName}"`);
        } else {
          if (!careerCode) throw new BadRequestException('careerCode requerido');
          if (!groupName) throw new BadRequestException('groupName requerido');
          if (!subjectCode) throw new BadRequestException('subjectCode requerido');
          if (!teacherEmployeeNumber) throw new BadRequestException('teacherEmployeeNumber requerido');

          group = await this.getGroup(periodName, careerCode, groupName);
          subject = await this.getSubjectByCode(subjectCode);
          teacher = await this.getTeacherByEmployeeNumber(teacherEmployeeNumber);
        }

        // upsert por llave natural (period+type+day+start+end+ref)
        const filter: any = {
          periodId: period._id,
          type: type === 'extracurricular' ? 'extracurricular' : 'class',
          dayOfWeek,
          startTime,
          endTime,
        };
        if (type === 'extracurricular') filter.activityId = activity?._id;
        else {
          filter.groupId = group?._id;
          filter.subjectId = subject?._id;
          filter.teacherId = teacher?._id;
        }

        const existing = await this.sbModel.findOne(filter).exec();

        if (!existing) {
          created++;
          if (!dryRun) {
            await this.scheduleBlocksService.create({
              periodId: String(period._id),
              type: type === 'extracurricular' ? 'extracurricular' : 'class',
              deliveryMode,
              dayOfWeek,
              startTime,
              endTime,
              room,
              groupId: group ? String(group._id) : undefined,
              subjectId: subject ? String(subject._id) : undefined,
              teacherId: teacher ? String(teacher._id) : undefined,
              activityId: activity ? String(activity._id) : undefined,
            } as any);
          }
          continue;
        }

        const needsUpdate =
          String((existing as any).deliveryMode ?? 'presencial') !== String(deliveryMode) ||
          String((existing as any).room ?? '') !== String(room ?? '');

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.scheduleBlocksService.update(String((existing as any)._id), {
            deliveryMode,
            room,
          } as any);
        }
      } catch (e: any) {
        failed++;
        errors.push({ row: rowNum, message: e?.response?.message ?? e?.message ?? 'Error desconocido', data: row });
      }
    }

    return {
      entity: 'schedule-blocks',
      dryRun,
      total: rows.length,
      created,
      updated,
      skipped,
      failed,
      errors,
    };
  }
}
