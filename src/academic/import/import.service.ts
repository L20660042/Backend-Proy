import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parse } from 'csv-parse/sync';
import { ConfigService } from '@nestjs/config';

import { Period, PeriodDocument } from '../periods/schemas/period.schema';
import { Career, CareerDocument } from '../careers/schemas/career.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherDocument } from '../teachers/schemas/teacher.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { ClassAssignment, ClassAssignmentDocument } from '../class-assignments/schemas/class-assignment.schema';
import { ScheduleBlock, ScheduleBlockDocument } from '../schedule-blocks/schemas/schedule-block.schema';

import { CourseEnrollment, CourseEnrollmentDocument } from '../course-enrollments/schemas/course-enrollment.schema';

import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';
import { ActivityEnrollment, ActivityEnrollmentDocument } from '../activity-enrollments/schemas/activity-enrollment.schema';

import { StudentsService } from '../students/students.service';
import { ClassAssignmentsService } from '../class-assignments/class-assignments.service';
import { ScheduleBlocksService } from '../schedule-blocks/schedule-blocks.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { ActivityEnrollmentsService } from '../activity-enrollments/activity-enrollments.service';
import { UsersService } from '../../users/users.service';
import { Role } from '../../auth/roles.enum';

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
  | 'activity-enrollments'
  | 'grades';

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

  if (s === 'presencial') return 'presencial';
  if (s === 'semipresencial' || s === 'semi-presencial' || s === 'semi') return 'semipresencial';
  if (s === 'asincrono' || s === 'asíncrono' || s === 'async') return 'asincrono';

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

    @InjectModel(CourseEnrollment.name) private readonly ceModel: Model<CourseEnrollmentDocument>,

    private readonly studentsService: StudentsService,
    private readonly classAssignmentsService: ClassAssignmentsService,
    private readonly scheduleBlocksService: ScheduleBlocksService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly activityEnrollmentsService: ActivityEnrollmentsService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  private teacherEmailFromEmployeeNumber(employeeNumber: string) {
    const domain = String(this.config.get<string>('TEACHER_EMAIL_DOMAIN') ?? 'metricampus.local').trim();
    return `${String(employeeNumber).trim()}@${domain}`.toLowerCase();
  }

  private teacherDefaultPassword(employeeNumber: string) {
    const prefix = String(this.config.get<string>('TEACHER_DEFAULT_PASSWORD_PREFIX') ?? 'Metricamps@');
    return `${prefix}${String(employeeNumber).trim()}`;
  }

  private userStatusFromTeacherStatus(teacherStatus: 'active' | 'inactive' | 'suspended'): 'active' | 'inactive' | 'pending' {
    return teacherStatus === 'active' ? 'active' : 'inactive';
  }

  private async ensureTeacherUser(params: {
    teacherId: string;
    employeeNumber: string;
    teacherName: string;
    teacherStatus: 'active' | 'inactive' | 'suspended';
  }) {
    const email = this.teacherEmailFromEmployeeNumber(params.employeeNumber);
    const status = this.userStatusFromTeacherStatus(params.teacherStatus);

    const existing = await this.usersService.findByEmail(email);

    if (!existing) {
      // Crea el usuario del docente con password por defecto.
      await this.usersService.create({
        email,
        password: this.teacherDefaultPassword(params.employeeNumber),
        roles: [Role.DOCENTE],
        status,
        linkedEntityId: params.teacherId,
        teacherName: params.teacherName,
        employeeNumber: params.employeeNumber,
      } as any);
      return;
    }

    // Asegura que tenga rol DOCENTE, status y linkedEntityId correctos.
    const rolesRaw = Array.isArray((existing as any).roles) ? (existing as any).roles : [];
    const rolesUpper = rolesRaw.map((r: any) => String(r).toUpperCase());
    const nextRoles = rolesUpper.includes(Role.DOCENTE) ? rolesUpper : [...rolesUpper, Role.DOCENTE];

    await this.usersService.update(String((existing as any)._id), {
      roles: nextRoles,
      status,
      linkedEntityId: params.teacherId,
    } as any);
  }

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

    // Alineado a GroupsService: se normaliza en MAYÚSCULAS.
    const name = normUpper(groupName);
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
          await this.periodModel.updateOne({ _id: existing._id }, { $set: { startDate, endDate, isActive } }).exec();
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

        const needsUpdate = String(existing.name) !== name || String((existing as any).status ?? 'active') !== String(status);

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.careerModel
            .updateOne({ _id: existing._id }, { $set: { name, status: status === 'inactive' ? 'inactive' : 'active' } })
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
        const employeeNumber = norm(pick(row, ['employeeNumber', 'teacherEmployeeNumber', 'noEmpleado']));
        const name = norm(pick(row, ['name', 'teacherName']));
        const divisionId = norm(pick(row, ['divisionId'])) || null;
        const status = norm(pick(row, ['status'])) || 'active';

        if (!employeeNumber) throw new BadRequestException('employeeNumber requerido');
        if (!name) throw new BadRequestException('name requerido');

        const nextStatus = status === 'inactive' ? 'inactive' : status === 'suspended' ? 'suspended' : 'active';

        const existing = await this.teacherModel.findOne({ employeeNumber }).exec();

        // CREATE
        if (!existing) {
          created++;
          if (!dryRun) {
            const t = await this.teacherModel.create({
              employeeNumber,
              name,
              divisionId,
              status: nextStatus,
            } as any);

            await this.ensureTeacherUser({
              teacherId: String((t as any)._id),
              employeeNumber,
              teacherName: name,
              teacherStatus: nextStatus,
            });
          }
          continue;
        }

        const needsUpdate =
          String(existing.name) !== name ||
          String((existing as any).divisionId ?? null) !== String(divisionId ?? null) ||
          String((existing as any).status ?? 'active') !== nextStatus;

        // NO UPDATE => pero igual asegura que el usuario exista y esté linkeado
        if (!needsUpdate) {
          skipped++;
          if (!dryRun) {
            await this.ensureTeacherUser({
              teacherId: String((existing as any)._id),
              employeeNumber,
              teacherName: String((existing as any).name ?? name),
              teacherStatus: ((existing as any).status ?? 'active') as any,
            });
          }
          continue;
        }

        // UPDATE
        updated++;
        if (!dryRun) {
          await this.teacherModel
            .updateOne({ _id: (existing as any)._id }, { $set: { name, divisionId, status: nextStatus } })
            .exec();

          await this.ensureTeacherUser({
            teacherId: String((existing as any)._id),
            employeeNumber,
            teacherName: name,
            teacherStatus: nextStatus,
          });
        }
      } catch (e: any) {
        failed++;
        errors.push({
          row: rowNum,
          message: e?.response?.message ?? e?.message ?? 'Error desconocido',
          data: row,
        });
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
        const semesterRaw = pick(row, ['semester', 'semestre']);
        const careerIdRaw = norm(pick(row, ['careerId']));
        const careerCode = normUpper(pick(row, ['careerCode', 'career']));

        if (!code) throw new BadRequestException('code requerido');
        if (!name) throw new BadRequestException('name requerido');

        const semester = Number(String(semesterRaw ?? '').trim());
        if (!semesterRaw || Number.isNaN(semester) || semester < 1) throw new BadRequestException('semester requerido');

        let careerId: Types.ObjectId;
        if (careerIdRaw) {
          if (!Types.ObjectId.isValid(careerIdRaw)) throw new BadRequestException('careerId inválido');
          careerId = new Types.ObjectId(careerIdRaw);
        } else {
          if (!careerCode) throw new BadRequestException('careerCode requerido');
          const career = await this.getCareerByCode(careerCode);
          careerId = career._id as any;
        }

        const existing = await this.subjectModel.findOne({ code }).exec();
        if (!existing) {
          created++;
          if (!dryRun) {
            await this.subjectModel.create({
              code,
              name,
              careerId,
              semester,
            } as any);
          }
          continue;
        }

        const needsUpdate =
          String(existing.name) !== name ||
          String((existing as any).careerId ?? '') !== String(careerId) ||
          Number((existing as any).semester ?? null) !== Number(semester);

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.subjectModel.updateOne({ _id: existing._id }, { $set: { name, careerId, semester } }).exec();
        }
      } catch (e: any) {
        failed++;
        errors.push({
          row: rowNum,
          message: e?.response?.message ?? e?.message ?? 'Error desconocido',
          data: row,
        });
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
        // Alineado a GroupsService: se normaliza en MAYÚSCULAS.
        const groupName = normUpper(pick(row, ['groupName', 'name', 'group']));
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
        const nameRaw = norm(pick(row, ['name', 'fullName', 'nombreCompleto', 'nombre']));
        const firstName = norm(pick(row, ['firstName']));
        const lastName = norm(pick(row, ['lastName', 'apellidos']));

        const careerIdRaw = norm(pick(row, ['careerId']));
        const careerCode = normUpper(pick(row, ['careerCode', 'career']));

        const periodName = norm(pick(row, ['periodName', 'periodo']));
        // Alineado a GroupsService: MAYÚSCULAS
        const groupName = normUpper(pick(row, ['groupName', 'grupo', 'group']));
        const groupIdRaw = norm(pick(row, ['groupId']));

        const status = normalizeStatus(pick(row, ['status']));

        if (!controlNumber) throw new BadRequestException('controlNumber requerido');

        const name = nameRaw || `${firstName} ${lastName}`.trim();
        if (!name) throw new BadRequestException('name requerido');

        let careerId: Types.ObjectId;
        if (careerIdRaw) {
          if (!Types.ObjectId.isValid(careerIdRaw)) throw new BadRequestException('careerId inválido');
          careerId = new Types.ObjectId(careerIdRaw);
        } else {
          if (!careerCode) throw new BadRequestException('careerCode requerido');
          const career = await this.getCareerByCode(careerCode);
          careerId = career._id as any;
        }

        let groupId: Types.ObjectId | null = null;

        if (groupIdRaw) {
          if (!Types.ObjectId.isValid(groupIdRaw)) throw new BadRequestException('groupId inválido');
          groupId = new Types.ObjectId(groupIdRaw);
        } else if (periodName && groupName) {
          const period = await this.getPeriodByName(periodName);
          const g = await this.groupModel.findOne({ periodId: period._id, careerId: careerId, name: groupName }).exec();
          if (!g) {
            throw new BadRequestException(
              `No existe Group "${groupName}" para ese periodo/carrera (period="${periodName}", career="${careerCode || careerIdRaw}")`,
            );
          }
          groupId = g._id as any;
        }

        const existing = await this.studentModel.findOne({ controlNumber }).exec();

        if (!existing) {
          created++;
          if (!dryRun) {
            await this.studentsService.create({
              controlNumber,
              name,
              careerId: String(careerId),
              groupId: groupId ? String(groupId) : undefined,
              status,
            } as any);
          }
          continue;
        }

        const needsUpdate =
          String((existing as any).name ?? '') !== name ||
          String((existing as any).careerId ?? '') !== String(careerId) ||
          String((existing as any).groupId ?? '') !== String(groupId ?? '') ||
          String((existing as any).status ?? 'active') !== String(status);

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.studentsService.update(String((existing as any)._id), {
            name,
            careerId: String(careerId),
            groupId: groupId ? String(groupId) : null,
            status,
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
        // Alineado a GroupsService: se normaliza en MAYÚSCULAS.
        const groupName = normUpper(pick(row, ['groupName', 'group']));
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

        if (dryRun) {
          skipped++;
          continue;
        }

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

async importGrades(file: Express.Multer.File, dryRun = false): Promise<ImportResult> {
  const rows = parseCsv(file);
  const errors: ImportError[] = [];
  let created = 0,
    updated = 0,
    skipped = 0,
    failed = 0;

  function parseGrade(raw: any, field: string): number | null | undefined {
    // undefined => no columna o no se quiere actualizar
    const s = norm(raw);
    if (s === '') return undefined;
    if (s === '-' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a') return null;

    const n = Number(s);
    if (!Number.isFinite(n)) throw new BadRequestException(`${field} inválido: "${s}"`);
    if (n < 0 || n > 100) throw new BadRequestException(`${field} fuera de rango (0..100): "${s}"`);
    return n;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const periodName = norm(pick(row, ['periodName', 'period', 'periodo']));
      const careerCode = normUpper(pick(row, ['careerCode', 'career', 'carrera']));
      const groupName = normUpper(pick(row, ['groupName', 'group', 'grupo']));
      const subjectCode = normUpper(pick(row, ['subjectCode', 'subject', 'materia', 'claveMateria']));
      const teacherEmployeeNumber = norm(pick(row, ['teacherEmployeeNumber', 'employeeNumber', 'docente', 'noEmpleado']));
      const studentControlNumber = norm(pick(row, ['studentControlNumber', 'controlNumber', 'alumno', 'noControl']));

      if (!periodName) throw new BadRequestException('periodName requerido');
      if (!careerCode) throw new BadRequestException('careerCode requerido');
      if (!groupName) throw new BadRequestException('groupName requerido');
      if (!subjectCode) throw new BadRequestException('subjectCode requerido');
      if (!studentControlNumber) throw new BadRequestException('studentControlNumber requerido');

      const period = await this.getPeriodByName(periodName);
      const group = await this.getGroup(periodName, careerCode, groupName);
      const subject = await this.getSubjectByCode(subjectCode);

      const student = await this.studentModel.findOne({ controlNumber: studentControlNumber }).exec();
      if (!student) throw new BadRequestException(`No existe Student con controlNumber="${studentControlNumber}"`);

      // classAssignment: prefer teacher match if provided
      const caFilter: any = {
        periodId: period._id,
        groupId: group._id,
        subjectId: subject._id,
        status: 'active',
      };

      let teacher: any = null;
      if (teacherEmployeeNumber) {
        teacher = await this.getTeacherByEmployeeNumber(teacherEmployeeNumber);
        caFilter.teacherId = teacher._id;
      }

      let ca = await this.caModel.findOne(caFilter).exec();

      if (!ca && teacherEmployeeNumber) {
        // Si no encontró con teacherId, intenta sin teacher (por si el CSV viene sin el dato correcto)
        const alt = await this.caModel.findOne({
          periodId: period._id,
          groupId: group._id,
          subjectId: subject._id,
          status: 'active',
        }).exec();
        if (alt) ca = alt as any;
      }

      if (!ca) {
        throw new BadRequestException(
          `No existe ClassAssignment para period="${periodName}", career="${careerCode}", group="${groupName}", subject="${subjectCode}"` +
            (teacherEmployeeNumber ? `, teacherEmployeeNumber="${teacherEmployeeNumber}"` : ''),
        );
      }

      // Parse unit grades + finalGrade
      const u1 = parseGrade(pick(row, ['u1', 'unit1', 'unidad1']), 'u1');
      const u2 = parseGrade(pick(row, ['u2', 'unit2', 'unidad2']), 'u2');
      const u3 = parseGrade(pick(row, ['u3', 'unit3', 'unidad3']), 'u3');
      const u4 = parseGrade(pick(row, ['u4', 'unit4', 'unidad4']), 'u4');
      const u5 = parseGrade(pick(row, ['u5', 'unit5', 'unidad5']), 'u5');
      const finalGradeRaw = pick(row, ['finalGrade', 'final', 'calificacionFinal', 'calificacionfinal']);
      const finalGrade = finalGradeRaw === undefined ? undefined : parseGrade(finalGradeRaw, 'finalGrade');

      const setOps: any = {};
      if (u1 !== undefined) setOps['unitGrades.u1'] = u1;
      if (u2 !== undefined) setOps['unitGrades.u2'] = u2;
      if (u3 !== undefined) setOps['unitGrades.u3'] = u3;
      if (u4 !== undefined) setOps['unitGrades.u4'] = u4;
      if (u5 !== undefined) setOps['unitGrades.u5'] = u5;
      if (finalGrade !== undefined) setOps['finalGrade'] = finalGrade;

      // Si no hay ninguna columna de calificación, es un CSV inválido.
      if (Object.keys(setOps).length === 0) throw new BadRequestException('CSV sin columnas de calificación (u1..u5/finalGrade)');

      // metadata
      if (finalGrade !== undefined || u1 !== undefined || u2 !== undefined || u3 !== undefined || u4 !== undefined || u5 !== undefined) {
        setOps['gradedAt'] = new Date();
        if (!teacher) teacher = await this.teacherModel.findById((ca as any).teacherId).exec();
        if (teacher) setOps['gradedByTeacherId'] = (teacher as any)._id;
      }

      const filter = {
        periodId: period._id,
        studentId: (student as any)._id,
        classAssignmentId: (ca as any)._id,
      };
      const update: any = {
      $set: setOps,
      $setOnInsert: {
        periodId: period._id,
        studentId: (student as any)._id,
        classAssignmentId: (ca as any)._id,
        groupId: (ca as any).groupId,
        subjectId: (ca as any).subjectId,
        teacherId: (ca as any).teacherId,
        status: 'active',
      },
    };


      if (dryRun) {
        // no contamos upserts reales; simulamos como updated
        updated += 1;
        continue;
      }

      const res: any = await this.ceModel.updateOne(filter, update, { upsert: true }).exec();
      const upserted = Number(res?.upsertedCount ?? 0);
      const modified = Number(res?.modifiedCount ?? 0);
      const matched = Number(res?.matchedCount ?? 0);

      if (upserted > 0) created += 1;
      else if (modified > 0) updated += 1;
      else if (matched > 0) skipped += 1;
      else skipped += 1;
    } catch (e: any) {
      failed += 1;
      errors.push({
        row: rowNum,
        message: e?.message ?? String(e),
        data: row,
      });
    }
  }

  return {
    entity: 'grades',
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
        const rawType = norm(pick(row, ['type'])) || 'class';
        const type = rawType === 'extracurricular' ? 'extracurricular' : 'class';

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

        const period = await this.getPeriodByName(periodName);

        let group: any = null;
        let subject: any = null;
        let teacher: any = null;
        let activity: any = null;

        if (type === 'extracurricular') {
          if (!activityName) throw new BadRequestException('activityName requerido para type=extracurricular');
          activity = await this.activityModel.findOne({ periodId: period._id, name: activityName }).exec();
          if (!activity)
            throw new BadRequestException(`No existe Activity con name="${activityName}" en el periodo "${periodName}"`);
        } else {
          if (!careerCode) throw new BadRequestException('careerCode requerido');
          if (!groupName) throw new BadRequestException('groupName requerido');
          if (!subjectCode) throw new BadRequestException('subjectCode requerido');
          if (!teacherEmployeeNumber) throw new BadRequestException('teacherEmployeeNumber requerido');

          group = await this.getGroup(periodName, careerCode, groupName);
          subject = await this.getSubjectByCode(subjectCode);
          teacher = await this.getTeacherByEmployeeNumber(teacherEmployeeNumber);
        }

        const filter: any = {
          periodId: period._id,
          type,
          dayOfWeek,
          startTime,
          endTime,
        };

        if (type === 'extracurricular') {
          filter.activityId = activity?._id;
        } else {
          filter.groupId = group?._id;
          filter.subjectId = subject?._id;
        }

        const existing = await this.sbModel.findOne(filter).exec();

        if (!existing) {
          created++;
          if (!dryRun) {
            await this.scheduleBlocksService.create({
              periodId: String(period._id),
              type,
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
          String((existing as any).room ?? '') !== String(room ?? '') ||
          (type === 'class' && String((existing as any).teacherId ?? '') !== String(teacher?._id ?? ''));

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        updated++;
        if (!dryRun) {
          await this.scheduleBlocksService.update(String((existing as any)._id), {
            deliveryMode,
            room,
            teacherId: type === 'class' ? String(teacher._id) : undefined,
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
