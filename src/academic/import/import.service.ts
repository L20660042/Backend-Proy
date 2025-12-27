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

import { StudentsService } from '../students/students.service';
import { ClassAssignmentsService } from '../class-assignments/class-assignments.service';
import { ScheduleBlocksService } from '../schedule-blocks/schedule-blocks.service';

type DeliveryMode = 'presencial' | 'semipresencial' | 'asincrono';

type ImportError = {
  row: number; // 2 = primera fila de datos (porque header=1)
  message: string;
  data?: any;
};

type ImportResult = {
  entity: 'students' | 'class-assignments' | 'schedule-blocks';
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
};

function norm(s: any) {
  return String(s ?? '').trim();
}

function buildLowerKeyMap(row: any) {
  const m = new Map<string, any>();
  for (const k of Object.keys(row ?? {})) m.set(k.toLowerCase(), row[k]);
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

  return parse(txt, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as any[];
}

function normalizeDeliveryMode(raw: any): DeliveryMode {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  if (!s) return 'presencial';
  if (s === 'presencial') return 'presencial';
  if (s === 'semipresencial' || s === 'semi-presencial') return 'semipresencial';
  if (s === 'asincrono' || s === 'asíncrono') return 'asincrono';

  return 'presencial';
}

@Injectable()
export class ImportService {
  constructor(
    @InjectModel(Period.name) private readonly periodModel: Model<PeriodDocument>,
    @InjectModel(Career.name) private readonly careerModel: Model<CareerDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Subject.name) private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Teacher.name) private readonly teacherModel: Model<TeacherDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(ClassAssignment.name) private readonly caModel: Model<ClassAssignmentDocument>,
    @InjectModel(ScheduleBlock.name) private readonly sbModel: Model<ScheduleBlockDocument>,

    private readonly studentsService: StudentsService,
    private readonly classAssignmentsService: ClassAssignmentsService,
    private readonly scheduleBlocksService: ScheduleBlocksService,
  ) {}

  // ---- caches (evita consultas repetidas) ----
  private periodCache = new Map<string, PeriodDocument>();
  private careerCache = new Map<string, CareerDocument>();
  private subjectCache = new Map<string, SubjectDocument>();
  private teacherCache = new Map<string, TeacherDocument>();
  private groupCache = new Map<string, GroupDocument>(); // key = periodId|careerId|groupName

  private async getPeriodByName(periodName: string) {
    const key = norm(periodName);
    if (!key) throw new BadRequestException('periodName requerido');

    const cached = this.periodCache.get(key);
    if (cached) return cached;

    // 1) exact match (rápido)
    const exact = await this.periodModel.findOne({ name: key }).exec();
    if (exact) {
      this.periodCache.set(key, exact);
      return exact;
    }

    // 2) fallback case-insensitive (evita problemas de mayúsculas)
    const ci = await this.periodModel.findOne({ name: { $regex: new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).exec();
    if (!ci) throw new BadRequestException(`No existe Period con name="${key}"`);

    this.periodCache.set(key, ci);
    return ci;
  }

  private async getCareerByCode(careerCode: string) {
    const key = norm(careerCode).toUpperCase();
    if (!key) throw new BadRequestException('careerCode requerido');
    const cached = this.careerCache.get(key);
    if (cached) return cached;

    const c = await this.careerModel.findOne({ code: key }).exec();
    if (!c) throw new BadRequestException(`No existe Career con code="${key}"`);
    this.careerCache.set(key, c);
    return c;
  }

  private async getSubjectByCode(subjectCode: string) {
    const key = norm(subjectCode).toUpperCase();
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
    const gname = norm(groupName);
    if (!gname) throw new BadRequestException('groupName requerido');

    const key = `${String(periodId)}|${String(careerId)}|${gname}`;
    const cached = this.groupCache.get(key);
    if (cached) return cached;

    const g = await this.groupModel.findOne({ periodId, careerId, name: gname }).exec();
    if (!g) throw new BadRequestException(`No existe Group "${gname}" para ese periodo/carrera`);

    this.groupCache.set(key, g);
    return g;
  }

  // ---- IMPORT: STUDENTS ----
  async importStudents(file: Express.Multer.File, dryRun: boolean): Promise<ImportResult> {
    const rows = parseCsv(file);

    const result: ImportResult = {
      entity: 'students',
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
        const controlNumber = norm(pick(row, ['controlNumber', 'control_number', 'noControl', 'no_control']));
        const name = norm(pick(row, ['name', 'nombre']));
        const careerCode = norm(pick(row, ['careerCode', 'career_code', 'carreraCode', 'carrera_code', 'career']));
        const status = norm(pick(row, ['status', 'estatus'])) || 'active';

        const groupName = norm(pick(row, ['groupName', 'group_name', 'grupo']));
        const periodName = norm(pick(row, ['periodName', 'period_name', 'periodo']));

        if (!controlNumber) throw new BadRequestException('controlNumber requerido');
        if (!name) throw new BadRequestException('name requerido');
        if (!careerCode) throw new BadRequestException('careerCode requerido');

        const career = await this.getCareerByCode(careerCode);

        // groupId en Student es opcional; si lo mandas, debe venir con periodName
        let groupId: string | null = null;
        if (groupName) {
          if (!periodName) throw new BadRequestException('Si envías groupName debes enviar periodName');
          const period = await this.getPeriodByName(periodName);
          const group = await this.getGroup(period._id, career._id, groupName);
          groupId = String(group._id);
        }

        const existing = await this.studentModel.findOne({ controlNumber }).exec();

        if (!existing) {
          if (!dryRun) {
            await this.studentsService.create({
              controlNumber,
              name,
              careerId: String(career._id),
              groupId: groupId ?? undefined,
              status: status as any,
            } as any);
          }
          result.created++;
        } else {
          const needsUpdate =
            existing.name !== name ||
            String(existing.careerId) !== String(career._id) ||
            String(existing.groupId ?? '') !== String(groupId ?? '') ||
            existing.status !== (status as any);

          if (!needsUpdate) {
            result.skipped++;
          } else {
            if (!dryRun) {
              await this.studentsService.update(String(existing._id), {
                name,
                careerId: String(career._id),
                groupId: groupId ?? null,
                status: status as any,
              } as any);
            }
            result.updated++;
          }
        }
      } catch (e: any) {
        result.failed++;
        result.errors.push({
          row: rowNo,
          message: e?.response?.message ?? e?.message ?? 'Error desconocido',
          data: row,
        });
      }
    }

    return result;
  }

  // ---- IMPORT: CLASS ASSIGNMENTS ----
  async importClassAssignments(file: Express.Multer.File, dryRun: boolean): Promise<ImportResult> {
    const rows = parseCsv(file);

    const result: ImportResult = {
      entity: 'class-assignments',
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
        const periodName = norm(pick(row, ['periodName', 'period_name', 'periodo']));
        const careerCode = norm(pick(row, ['careerCode', 'career_code', 'carreraCode', 'carrera_code']));
        const groupName = norm(pick(row, ['groupName', 'group_name', 'grupo']));
        const subjectCode = norm(pick(row, ['subjectCode', 'subject_code', 'materiaCode', 'materia_code']));
        const teacherEmp = norm(
          pick(row, ['teacherEmployeeNumber', 'teacher_employeeNumber', 'employeeNumber', 'noEmpleado', 'no_empleado']),
        );
        const status = norm(pick(row, ['status', 'estatus'])) || 'active';

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!careerCode) throw new BadRequestException('careerCode requerido');
        if (!groupName) throw new BadRequestException('groupName requerido');
        if (!subjectCode) throw new BadRequestException('subjectCode requerido');
        if (!teacherEmp) throw new BadRequestException('teacherEmployeeNumber requerido');

        const period = await this.getPeriodByName(periodName);
        const career = await this.getCareerByCode(careerCode);
        const group = await this.getGroup(period._id, career._id, groupName);
        const subject = await this.getSubjectByCode(subjectCode);
        const teacher = await this.getTeacherByEmployeeNumber(teacherEmp);

        if (String(subject.careerId) !== String(career._id)) {
          throw new BadRequestException(`La materia ${subject.code} no pertenece a la carrera ${career.code}`);
        }

        const existing = await this.caModel
          .findOne({ periodId: period._id, groupId: group._id, subjectId: subject._id })
          .exec();

        if (!existing) {
          if (!dryRun) {
            await this.classAssignmentsService.create({
              periodId: String(period._id),
              careerId: String(career._id),
              groupId: String(group._id),
              subjectId: String(subject._id),
              teacherId: String(teacher._id),
              status: status as any,
            } as any);
          }
          result.created++;
        } else {
          const needsUpdate =
            String(existing.teacherId) !== String(teacher._id) ||
            existing.status !== (status as any) ||
            String(existing.careerId) !== String(career._id);

          if (!needsUpdate) {
            result.skipped++;
          } else {
            if (!dryRun) {
              await this.classAssignmentsService.update(String(existing._id), {
                teacherId: String(teacher._id),
                careerId: String(career._id),
                status: status as any,
              } as any);
            }
            result.updated++;
          }
        }
      } catch (e: any) {
        result.failed++;
        result.errors.push({
          row: rowNo,
          message: e?.response?.message ?? e?.message ?? 'Error desconocido',
          data: row,
        });
      }
    }

    return result;
  }

  // ---- IMPORT: SCHEDULE BLOCKS (CLASES) ----
  async importScheduleBlocks(file: Express.Multer.File, dryRun: boolean): Promise<ImportResult> {
    const rows = parseCsv(file);

    const result: ImportResult = {
      entity: 'schedule-blocks',
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
        const periodName = norm(pick(row, ['periodName', 'period_name', 'periodo']));
        const careerCode = norm(pick(row, ['careerCode', 'career_code', 'carreraCode', 'carrera_code']));
        const groupName = norm(pick(row, ['groupName', 'group_name', 'grupo']));
        const subjectCode = norm(pick(row, ['subjectCode', 'subject_code', 'materiaCode', 'materia_code']));
        const teacherEmp = norm(pick(row, ['teacherEmployeeNumber', 'employeeNumber', 'noEmpleado', 'no_empleado']));

        const dayOfWeekRaw = pick(row, ['dayOfWeek', 'day_of_week', 'dia', 'diaSemana', 'dia_semana']);
        const startTime = norm(pick(row, ['startTime', 'start_time', 'horaInicio', 'hora_inicio']));
        const endTime = norm(pick(row, ['endTime', 'end_time', 'horaFin', 'hora_fin']));
        const room = norm(pick(row, ['room', 'aula', 'salon', 'salón'])) || null;

        // ✅ NUEVO: modalidad
        const deliveryModeRaw = pick(row, ['deliveryMode', 'delivery_mode', 'modalidad', 'mode']);
        const deliveryMode: DeliveryMode = normalizeDeliveryMode(deliveryModeRaw);

        if (!periodName) throw new BadRequestException('periodName requerido');
        if (!careerCode) throw new BadRequestException('careerCode requerido');
        if (!groupName) throw new BadRequestException('groupName requerido');
        if (!subjectCode) throw new BadRequestException('subjectCode requerido');
        if (!teacherEmp) throw new BadRequestException('teacherEmployeeNumber requerido');

        if (dayOfWeekRaw === undefined || dayOfWeekRaw === null || norm(dayOfWeekRaw) === '') {
          throw new BadRequestException('dayOfWeek requerido (1=Lun ... 7=Dom)');
        }
        const dayOfWeek = Number(dayOfWeekRaw);
        if (![1, 2, 3, 4, 5, 6, 7].includes(dayOfWeek)) {
          throw new BadRequestException('dayOfWeek inválido (1..7)');
        }
        if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) throw new BadRequestException('startTime inválido (HH:MM)');
        if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) throw new BadRequestException('endTime inválido (HH:MM)');

        const period = await this.getPeriodByName(periodName);
        const career = await this.getCareerByCode(careerCode);
        const group = await this.getGroup(period._id, career._id, groupName);
        const subject = await this.getSubjectByCode(subjectCode);
        const teacher = await this.getTeacherByEmployeeNumber(teacherEmp);

        if (String(subject.careerId) !== String(career._id)) {
          throw new BadRequestException(`La materia ${subject.code} no pertenece a la carrera ${career.code}`);
        }

        // Upsert por clave “natural”
        // (No metemos deliveryMode en la clave: si cambia, lo actualizamos)
        const existing = await this.sbModel
          .findOne({
            periodId: period._id,
            type: 'class',
            dayOfWeek,
            startTime,
            endTime,
            groupId: group._id,
            subjectId: subject._id,
            teacherId: teacher._id,
          })
          .exec();

        if (!existing) {
          if (!dryRun) {
            await this.scheduleBlocksService.create({
              periodId: String(period._id),
              type: 'class',
              deliveryMode,
              dayOfWeek,
              startTime,
              endTime,
              room: room ?? null,
              groupId: String(group._id),
              subjectId: String(subject._id),
              teacherId: String(teacher._id),
            } as any);
          }
          result.created++;
        } else {
          const existingMode = normalizeDeliveryMode((existing as any).deliveryMode);
          const needsUpdate =
            String(existing.room ?? '') !== String(room ?? '') ||
            existingMode !== deliveryMode;

          if (!needsUpdate) {
            result.skipped++;
          } else {
            if (!dryRun) {
              await this.scheduleBlocksService.update(String(existing._id), {
                room: room ?? null,
                deliveryMode,
              } as any);
            }
            result.updated++;
          }
        }
      } catch (e: any) {
        result.failed++;
        result.errors.push({
          row: rowNo,
          message: e?.response?.message ?? e?.message ?? 'Error desconocido',
          data: row,
        });
      }
    }

    return result;
  }
}
