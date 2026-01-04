import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ScheduleBlocksService } from '../schedule-blocks/schedule-blocks.service';
import { CourseEnrollmentsService } from '../course-enrollments/course-enrollments.service';

import {
  ActivityEnrollment,
  ActivityEnrollmentDocument,
} from './schemas/activity-enrollment.schema';

type DeliveryMode = 'presencial' | 'semipresencial' | 'asincrono';

function oid(id: any) {
  return String((id as any)?._id ?? id ?? '');
}

function toMinutes(hhmm: string): number {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function dayName(d: number) {
  switch (Number(d)) {
    case 1:
      return 'Lunes';
    case 2:
      return 'Martes';
    case 3:
      return 'Miércoles';
    case 4:
      return 'Jueves';
    case 5:
      return 'Viernes';
    case 6:
      return 'Sábado';
    case 7:
      return 'Domingo';
    default:
      return `Día ${d}`;
  }
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

function labelClassBlock(b: any) {
  const subj = b?.subjectId?.code
    ? `${b.subjectId.code} - ${b.subjectId.name ?? ''}`.trim()
    : b?.subjectId?.name ?? 'Materia';
  const group = b?.groupId?.name ?? 'Grupo';
  return `${subj} (${group})`;
}

function labelActivityBlock(b: any) {
  return b?.activityId?.name ?? 'Actividad';
}

function csvCell(v: any): string {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  const needsQuote = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

@Injectable()
export class ActivityEnrollmentsService {
  constructor(
    @InjectModel(ActivityEnrollment.name)
    private readonly model: Model<ActivityEnrollmentDocument>,
    private readonly scheduleBlocks: ScheduleBlocksService,
    private readonly courseEnrollments: CourseEnrollmentsService,
  ) {}

  async findAll(params?: {
    periodId?: string;
    activityId?: string;
    studentId?: string;
    status?: string;
  }) {
    const filter: any = {};
    if (params?.periodId) filter.periodId = new Types.ObjectId(params.periodId);
    if (params?.activityId) filter.activityId = new Types.ObjectId(params.activityId);
    if (params?.studentId) filter.studentId = new Types.ObjectId(params.studentId);
    if (params?.status) filter.status = params.status;

    return this.model
      .find(filter)
      .populate('periodId', 'name')
      .populate('activityId', 'name type responsibleName capacity status')
      .populate('studentId', 'controlNumber name')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');

    const doc = await this.model
      .findById(id)
      .populate('periodId', 'name')
      .populate('activityId', 'name type responsibleName capacity status')
      .populate('studentId', 'controlNumber name')
      .exec();

    if (!doc) throw new NotFoundException('Inscripción extraescolar no encontrada');
    return doc;
  }

  async getMy(periodId: string, user: any) {
    const roles: string[] = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
    const linkedEntityId: string | null = user?.linkedEntityId ?? null;

    if (!periodId) throw new BadRequestException('periodId requerido');
    if (!linkedEntityId) throw new ForbiddenException('El usuario no tiene linkedEntityId');

    const isStudent = roles.includes('ALUMNO') || roles.includes('ESTUDIANTE');
    if (!isStudent) throw new ForbiddenException('Solo alumno puede consultar sus actividades');

    return this.model
      .find({
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(linkedEntityId),
        status: 'active',
      })
      .populate('activityId', 'name type responsibleName capacity status')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActiveByStudentAndPeriod(periodId: string, studentId: string) {
    if (!periodId) throw new BadRequestException('periodId requerido');
    if (!studentId) throw new BadRequestException('studentId requerido');

    return this.model
      .find({
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(studentId),
        status: 'active',
      })
      .select('activityId')
      .lean()
      .exec();
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');

    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Inscripción extraescolar no encontrada');

    return { deleted: true };
  }

  async reportByActivity(params: { periodId: string; activityId: string; status?: string }) {
    const { periodId, activityId } = params;
    const status = params.status ?? 'active';

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(activityId)) throw new BadRequestException('activityId inválido');

    const filter: any = {
      periodId: new Types.ObjectId(periodId),
      activityId: new Types.ObjectId(activityId),
    };
    if (status && status !== 'all') filter.status = status;

    const docs = await this.model
      .find(filter)
      .populate('periodId', 'name')
      .populate('activityId', 'name type')
      .populate({
        path: 'studentId',
        select: 'controlNumber name careerId groupId',
        populate: [
          { path: 'careerId', select: 'code name' },
          { path: 'groupId', select: 'name semester' },
        ],
      })
      .lean()
      .exec();

    const rows = (docs ?? []).map((d: any) => {
      const st = d.studentId ?? {};
      const career = st.careerId ?? {};
      const group = st.groupId ?? {};

      return {
        controlNumber: st.controlNumber ?? '',
        name: st.name ?? '',
        careerCode: career.code ?? '',
        careerName: career.name ?? '',
        groupName: group.name ?? '',
        groupSemester: typeof group.semester === 'number' ? group.semester : '',
        status: d.status ?? '',
      };
    });

    rows.sort((a, b) => {
      const an = String(a.name).toLowerCase();
      const bn = String(b.name).toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return String(a.controlNumber).localeCompare(String(b.controlNumber));
    });

const first: any = (docs as any)?.[0];

const periodName = first?.periodId?.name ?? '';
const activityName = first?.activityId?.name ?? '';
const activityType = first?.activityId?.type ?? '';


    const header = ['NoControl', 'Nombre', 'CarreraCodigo', 'Carrera', 'Grupo', 'SemestreGrupo', 'Estatus'];
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map((r) =>
        [
          r.controlNumber,
          r.name,
          r.careerCode,
          r.careerName,
          r.groupName,
          r.groupSemester,
          r.status,
        ].map(csvCell).join(','),
      ),
    ];

    // BOM para Excel (acentos correctos)
    const csv = '\ufeff' + lines.join('\n');

    return {
      meta: {
        periodId,
        periodName,
        activityId,
        activityName,
        activityType,
        total: rows.length,
        generatedAt: new Date().toISOString(),
        statusFilter: status,
      },
      rows,
      csv,
    };
  }

  public async validateStudentScheduleConflictsForActivity(params: {
    periodId: string;
    studentId: string;
    activityId: string;
  }) {
    const { periodId, studentId, activityId } = params;

    // 1) Bloques de la actividad candidata
    const candidateBlocks = await this.scheduleBlocks.findByActivityIds({
      periodId,
      activityIds: [activityId],
    });

    if (!candidateBlocks || candidateBlocks.length === 0) {
      throw new BadRequestException('La actividad no tiene horario (schedule-blocks) configurado');
    }

    // 2) Materias activas del alumno
    const ces = await this.courseEnrollments.findActiveByStudentAndPeriod(periodId, studentId);

    const triples: Array<{ groupId: string; subjectId: string; teacherId: string }> = [];
    const seen = new Set<string>();

    for (const ce of (ces as any[]) ?? []) {
      const g = String(ce.groupId);
      const s = String(ce.subjectId);
      const t = String(ce.teacherId);
      const key = `${g}|${s}|${t}`;
      if (seen.has(key)) continue;
      seen.add(key);
      triples.push({ groupId: g, subjectId: s, teacherId: t });
    }

    const classBlocks = triples.length
      ? await this.scheduleBlocks.findByClassTriples({ periodId, triples })
      : [];

    // 3) Otras actividades activas del alumno
    const existingActs = await this.model
      .find({
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(studentId),
        status: 'active',
        activityId: { $ne: new Types.ObjectId(activityId) },
      })
      .select({ activityId: 1 })
      .lean();

    const existingActivityIds = Array.from(
      new Set((existingActs ?? []).map((x: any) => oid(x.activityId)).filter(Boolean)),
    );

    const existingActivityBlocks = existingActivityIds.length
      ? await this.scheduleBlocks.findByActivityIds({ periodId, activityIds: existingActivityIds })
      : [];

    // Index existentes por día
    const existingByDay = new Map<number, any[]>();

    // Materias: solo bloquean si PRESENCIAL
    for (const b of (classBlocks as any[]) ?? []) {
      const mode = normalizeDeliveryMode(b.deliveryMode);
      if (mode !== 'presencial') continue;

      const d = Number(b.dayOfWeek);
      const arr = existingByDay.get(d) ?? [];
      arr.push({ ...b, __kind: 'class' });
      existingByDay.set(d, arr);
    }

    // Actividades: presenciales por definición MVP
    for (const b of (existingActivityBlocks as any[]) ?? []) {
      const d = Number(b.dayOfWeek);
      const arr = existingByDay.get(d) ?? [];
      arr.push({ ...b, __kind: 'activity' });
      existingByDay.set(d, arr);
    }

    // Comparar candidato vs existentes
    for (const nb of (candidateBlocks as any[]) ?? []) {
      const day = Number(nb.dayOfWeek);
      const arr = existingByDay.get(day) ?? [];
      if (!arr.length) continue;

      const ns = toMinutes(nb.startTime);
      const ne = toMinutes(nb.endTime);

      for (const eb of arr) {
        const es = toMinutes(eb.startTime);
        const ee = toMinutes(eb.endTime);
        if (!overlaps(ns, ne, es, ee)) continue;

        const newLabel = labelActivityBlock(nb);
        const existLabel = eb.__kind === 'class' ? labelClassBlock(eb) : labelActivityBlock(eb);

        throw new BadRequestException(
          `Choque presencial: ${newLabel} se empalma con ${existLabel} el ${dayName(day)} ${nb.startTime}-${nb.endTime}.`,
        );
      }
    }
  }

  async create(dto: { periodId: string; studentId: string; activityId: string; status?: 'active' | 'inactive' }) {
    const periodId = dto.periodId;
    const studentId = dto.studentId;
    const activityId = dto.activityId;
    const status = dto.status ?? 'active';

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('studentId inválido');
    if (!Types.ObjectId.isValid(activityId)) throw new BadRequestException('activityId inválido');

    if (status === 'active') {
      await this.validateStudentScheduleConflictsForActivity({ periodId, studentId, activityId });
    }

    try {
      return await this.model.create({
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(studentId),
        activityId: new Types.ObjectId(activityId),
        status,
      });
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new BadRequestException('El alumno ya está inscrito en esta actividad en ese periodo');
      }
      throw e;
    }
  }

  async bulk(dto: { periodId: string; activityId: string; studentIds: string[]; status?: 'active' | 'inactive' }) {
    const periodId = dto.periodId;
    const activityId = dto.activityId;
    const status = dto.status ?? 'active';
    const studentIds = (dto.studentIds ?? []).filter(Boolean);

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(activityId)) throw new BadRequestException('activityId inválido');
    if (studentIds.length === 0) throw new BadRequestException('studentIds requerido');

    const errors: Array<{ studentId: string; message: string }> = [];
    let inserted = 0;

    for (const sid of studentIds) {
      try {
        if (!Types.ObjectId.isValid(sid)) throw new BadRequestException('studentId inválido');

        if (status === 'active') {
          await this.validateStudentScheduleConflictsForActivity({ periodId, studentId: sid, activityId });
        }

        // Upsert: evita duplicados y permite reactivar
        await this.model.updateOne(
          {
            periodId: new Types.ObjectId(periodId),
            studentId: new Types.ObjectId(sid),
            activityId: new Types.ObjectId(activityId),
          },
          {
            $set: { status },
            $setOnInsert: {
              periodId: new Types.ObjectId(periodId),
              studentId: new Types.ObjectId(sid),
              activityId: new Types.ObjectId(activityId),
            },
          },
          { upsert: true },
        );

        inserted += 1;
      } catch (e: any) {
        const msg = e?.response?.message ?? e?.message ?? 'Error';
        errors.push({
          studentId: sid,
          message: Array.isArray(msg) ? msg.join(' | ') : String(msg),
        });
      }
    }

    return { inserted, errors };
  }
}
