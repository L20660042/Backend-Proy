import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ClassAssignmentsService } from '../class-assignments/class-assignments.service';
import { ScheduleBlocksService } from '../schedule-blocks/schedule-blocks.service';
import { StudentsService } from '../students/students.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

import { CreateCourseEnrollmentDto } from './dto/create-course-enrollment.dto';
import { UpdateCourseEnrollmentDto } from './dto/update-course-enrollment.dto';
import { CourseEnrollment, CourseEnrollmentDocument } from './schemas/course-enrollment.schema';

function oid(id: any) {
  return String((id as any)?._id ?? id ?? '');
}

function validateFinalGrade(value: any) {
  if (value === undefined) return;
  if (value === null) return;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BadRequestException('finalGrade debe ser numérico (0..100) o null');
  if (n < 0 || n > 100) throw new BadRequestException('finalGrade fuera de rango (0..100)');
}

type DeliveryMode = 'presencial' | 'semipresencial' | 'asincrono';

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

function toMinutes(hhmm: string): number {
  const [h, m] = String(hhmm ?? '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function dayName(dayOfWeek: number): string {
  switch (Number(dayOfWeek)) {
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
      return `Día ${dayOfWeek}`;
  }
}

@Injectable()
export class CourseEnrollmentsService {
  constructor(
    @InjectModel(CourseEnrollment.name)
    private readonly model: Model<CourseEnrollmentDocument>,
    private readonly classAssignments: ClassAssignmentsService,
    private readonly blocks: ScheduleBlocksService,
    private readonly students: StudentsService,
    @Inject(forwardRef(() => EnrollmentsService))
    private readonly enrollments: EnrollmentsService,
  ) {}

  private async validateStudentScheduleConflicts(params: {
    periodId: string;
    studentId: string;
    candidateTriples: Array<{ groupId: string; subjectId: string; teacherId: string }>;
  }) {
    const { periodId, studentId } = params;

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('studentId inválido');

    // dedupe candidate triples
    const candSeen = new Set<string>();
    const candidateTriples = (params.candidateTriples ?? [])
      .map((t) => ({ groupId: String(t.groupId), subjectId: String(t.subjectId), teacherId: String(t.teacherId) }))
      .filter(
        (t) =>
          Types.ObjectId.isValid(t.groupId) &&
          Types.ObjectId.isValid(t.subjectId) &&
          Types.ObjectId.isValid(t.teacherId),
      )
      .filter((t) => {
        const k = `${t.groupId}|${t.subjectId}|${t.teacherId}`;
        if (candSeen.has(k)) return false;
        candSeen.add(k);
        return true;
      });

    if (candidateTriples.length === 0) return;

    const current = await this.findActiveByStudentAndPeriod(periodId, studentId);

    // existing triples (exclude ones that are the same as candidates)
    const existingSeen = new Set<string>();
    const existingTriples: Array<{ groupId: string; subjectId: string; teacherId: string }> = [];

    for (const ce of current as any[]) {
      const g = String(ce.groupId);
      const s = String(ce.subjectId);
      const t = String(ce.teacherId);
      const k = `${g}|${s}|${t}`;
      if (candSeen.has(k)) continue; // same class, ignore
      if (existingSeen.has(k)) continue;
      existingSeen.add(k);
      existingTriples.push({ groupId: g, subjectId: s, teacherId: t });
    }

    if (existingTriples.length === 0) return;

    // traer bloques de horario
    const [candBlocks, existingBlocks] = await Promise.all([
      this.blocks.findByClassTriples({ periodId, triples: candidateTriples }),
      this.blocks.findByClassTriples({ periodId, triples: existingTriples }),
    ]);

    if (!candBlocks?.length || !existingBlocks?.length) return;

    // pre-index existing by day
    const existingByDay = new Map<number, any[]>();
    for (const b of existingBlocks as any[]) {
      const d = Number(b.dayOfWeek);
      if (!existingByDay.has(d)) existingByDay.set(d, []);
      existingByDay.get(d)!.push(b);
    }

    for (const cb of candBlocks as any[]) {
      const day = Number(cb.dayOfWeek);
      const list = existingByDay.get(day) ?? [];
      if (list.length === 0) continue;

      const cMode = normalizeDeliveryMode(cb.deliveryMode);
      if (cMode !== 'presencial') continue; // candidato NO presencial: permite empalme

      const cs = toMinutes(cb.startTime);
      const ce = toMinutes(cb.endTime);

      for (const eb of list) {
        const eMode = normalizeDeliveryMode(eb.deliveryMode);
        if (eMode !== 'presencial') continue; // existente no presencial: permite empalme

        const es = toMinutes(eb.startTime);
        const ee = toMinutes(eb.endTime);
        if (!overlaps(cs, ce, es, ee)) continue;

        const cSubject = (cb.subjectId?.code ? `${cb.subjectId.code} - ` : '') + (cb.subjectId?.name ?? 'Materia');
        const eSubject = (eb.subjectId?.code ? `${eb.subjectId.code} - ` : '') + (eb.subjectId?.name ?? 'Materia');
        const cGroup = cb.groupId?.name ?? cb.groupId ?? 'Grupo';
        const eGroup = eb.groupId?.name ?? eb.groupId ?? 'Grupo';

        throw new BadRequestException(
          `Choque presencial para el alumno: "${cSubject}" (Grupo ${cGroup}) se empalma con "${eSubject}" (Grupo ${eGroup}) el ${dayName(
            day,
          )} ${cb.startTime}-${cb.endTime}. ` +
            `Si debe permitirse el empalme, marca una de las materias como semipresencial/asincrono en su ScheduleBlock.`,
        );
      }
    }
  }

  async list(params?: {
    periodId?: string;
    studentId?: string;
    classAssignmentId?: string;
    groupId?: string;
    subjectId?: string;
    teacherId?: string;
    status?: string;
  }) {
    const filter: any = {};
    if (params?.periodId) filter.periodId = new Types.ObjectId(params.periodId);
    if (params?.studentId) filter.studentId = new Types.ObjectId(params.studentId);
    if (params?.classAssignmentId) filter.classAssignmentId = new Types.ObjectId(params.classAssignmentId);
    if (params?.groupId) filter.groupId = new Types.ObjectId(params.groupId);
    if (params?.subjectId) filter.subjectId = new Types.ObjectId(params.subjectId);
    if (params?.teacherId) filter.teacherId = new Types.ObjectId(params.teacherId);
    if (params?.status) filter.status = params.status;

    return this.model
      .find(filter)
      .populate('studentId')
      .populate({
        path: 'classAssignmentId',
        populate: [
          { path: 'periodId', select: 'name' },
          { path: 'careerId', select: 'name code' },
          { path: 'groupId', select: 'name semester' },
          { path: 'subjectId', select: 'name code semester' },
          { path: 'teacherId', select: 'name employeeNumber' },
        ],
      })
      .populate('periodId')
      .populate('groupId')
      .populate('subjectId')
      .populate('teacherId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(dto: CreateCourseEnrollmentDto) {
    const { periodId, studentId, classAssignmentId } = dto;

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('studentId inválido');
    if (!Types.ObjectId.isValid(classAssignmentId)) throw new BadRequestException('classAssignmentId inválido');

    const ca = await this.classAssignments.findOne(classAssignmentId);
    if (!ca) throw new NotFoundException('Asignación (classAssignment) no encontrada');

    if (String((ca as any).periodId?._id ?? (ca as any).periodId) !== String(periodId)) {
      throw new BadRequestException('La asignación no pertenece al periodId indicado');
    }

    const status = (dto.status ?? 'active') as 'active' | 'inactive';
    if (status === 'active') {
      await this.validateStudentScheduleConflicts({
        periodId,
        studentId,
        candidateTriples: [
          {
            groupId: String((ca as any).groupId?._id ?? (ca as any).groupId),
            subjectId: String((ca as any).subjectId?._id ?? (ca as any).subjectId),
            teacherId: String((ca as any).teacherId?._id ?? (ca as any).teacherId),
          },
        ],
      });
    }

    try {
      return await this.model.create({
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(studentId),
        classAssignmentId: new Types.ObjectId(classAssignmentId),

        groupId: new Types.ObjectId(String((ca as any).groupId?._id ?? (ca as any).groupId)),
        subjectId: new Types.ObjectId(String((ca as any).subjectId?._id ?? (ca as any).subjectId)),
        teacherId: new Types.ObjectId(String((ca as any).teacherId?._id ?? (ca as any).teacherId)),

        status,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El alumno ya está inscrito a esa materia (carga) en ese periodo');
      }
      throw err;
    }
  }

  async updateAsAdmin(id: string, dto: UpdateCourseEnrollmentDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');

    validateFinalGrade((dto as any).finalGrade);

    const update: any = {};
    if ((dto as any).status !== undefined) update.status = (dto as any).status;
    if ((dto as any).finalGrade !== undefined) update.finalGrade = (dto as any).finalGrade;

    const doc = await this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate('studentId')
      .populate('classAssignmentId')
      .populate('periodId')
      .populate('groupId')
      .populate('subjectId')
      .populate('teacherId')
      .lean();

    if (!doc) throw new NotFoundException('Inscripción por materia no encontrada');
    return doc;
  }

  async updateAsTeacher(id: string, teacherId: string, dto: UpdateCourseEnrollmentDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');
    if (!Types.ObjectId.isValid(teacherId)) throw new BadRequestException('teacherId inválido');

    if ((dto as any).status !== undefined) {
      throw new ForbiddenException('El docente no puede modificar status');
    }

    validateFinalGrade((dto as any).finalGrade);
    if ((dto as any).finalGrade === undefined) {
      throw new BadRequestException('finalGrade requerido');
    }

    const current = await this.model.findById(id).lean();
    if (!current) throw new NotFoundException('Inscripción por materia no encontrada');

    if (String(current.teacherId) !== String(teacherId)) {
      throw new ForbiddenException('No puedes modificar calificación de una carga que no es tuya');
    }

    const doc = await this.model
      .findByIdAndUpdate(
        id,
        { $set: { finalGrade: (dto as any).finalGrade } },
        { new: true, runValidators: true },
      )
      .populate('studentId')
      .populate('classAssignmentId')
      .populate('periodId')
      .populate('groupId')
      .populate('subjectId')
      .populate('teacherId')
      .lean();

    if (!doc) throw new NotFoundException('Inscripción por materia no encontrada');
    return doc;
  }

  async update(id: string, dto: UpdateCourseEnrollmentDto) {
    return this.updateAsAdmin(id, dto);
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');
    const doc = await this.model.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundException('Inscripción por materia no encontrada');
    return { ok: true };
  }

  async findActiveByStudentAndPeriod(periodId: string, studentId: string) {
    if (!Types.ObjectId.isValid(periodId) || !Types.ObjectId.isValid(studentId)) return [];

    return this.model
      .find({
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(studentId),
        status: 'active',
      })
      .lean();
  }

  async syncStudentToGroupLoads(params: {
    periodId: string;
    studentId: string;
    groupId: string;
    status?: 'active' | 'inactive';
  }) {
    const { periodId, studentId, groupId } = params;
    const status = params.status ?? 'active';

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('studentId inválido');
    if (!Types.ObjectId.isValid(groupId)) throw new BadRequestException('groupId inválido');

    const classAssignments = await this.classAssignments.findAll({ periodId, groupId, status: 'active' });

    if (!classAssignments || classAssignments.length === 0) {
      return {
        ok: true,
        periodId,
        groupId,
        studentId,
        classAssignments: 0,
        attempted: 0,
        upserted: 0,
        matched: 0,
        modified: 0,
      };
    }
     if (status === 'active') {
      const triples: Array<{ groupId: string; subjectId: string; teacherId: string }> = [];
      const seen = new Set<string>();

      for (const ca of classAssignments as any[]) {
        const g = oid(ca.groupId);
        const s = oid(ca.subjectId);
        const t = oid(ca.teacherId);
        const k = `${g}|${s}|${t}`;
        if (seen.has(k)) continue;
        seen.add(k);
        triples.push({ groupId: g, subjectId: s, teacherId: t });
      }

      await this.validateStudentScheduleConflicts({ periodId, studentId, candidateTriples: triples });
    }

    const pid = new Types.ObjectId(periodId);
    const sid = new Types.ObjectId(studentId);

    const ops: any[] = [];
    for (const ca of classAssignments as any[]) {
      const caId = oid(ca._id);
      const caGroupId = oid(ca.groupId);
      const caSubjectId = oid(ca.subjectId);
      const caTeacherId = oid(ca.teacherId);

      ops.push({
        updateOne: {
          filter: {
            periodId: pid,
            studentId: sid,
            classAssignmentId: new Types.ObjectId(caId),
          },
          update: {
            $set: { status },
            $setOnInsert: {
              periodId: pid,
              studentId: sid,
              classAssignmentId: new Types.ObjectId(caId),
              groupId: new Types.ObjectId(caGroupId),
              subjectId: new Types.ObjectId(caSubjectId),
              teacherId: new Types.ObjectId(caTeacherId),
            },
          },
          upsert: true,
        },
      });
    }

    const res = await this.model.bulkWrite(ops, { ordered: false });

    return {
      ok: true,
      periodId,
      groupId,
      studentId,
      classAssignments: classAssignments.length,
      attempted: ops.length,
      upserted: res.upsertedCount ?? 0,
      matched: res.matchedCount ?? 0,
      modified: res.modifiedCount ?? 0,
    };
  }

  async deactivateByStudentAndGroup(params: { periodId: string; studentId: string; groupId: string }) {
    const { periodId, studentId, groupId } = params;

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('studentId inválido');
    if (!Types.ObjectId.isValid(groupId)) throw new BadRequestException('groupId inválido');

    const res: any = await this.model.updateMany(
      {
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(studentId),
        groupId: new Types.ObjectId(groupId),
      },
      { $set: { status: 'inactive' } },
    );

    return { ok: true, matched: res?.matchedCount ?? res?.n ?? 0, modified: res?.modifiedCount ?? res?.nModified ?? 0 };
  }

  async deactivateByStudentAndPeriod(params: { periodId: string; studentId: string }) {
    const { periodId, studentId } = params;

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('studentId inválido');

    const res: any = await this.model.updateMany(
      {
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(studentId),
      },
      { $set: { status: 'inactive' } },
    );

    return { ok: true, matched: res?.matchedCount ?? res?.n ?? 0, modified: res?.modifiedCount ?? res?.nModified ?? 0 };
  }

  async bulkEnrollByGroup(params: {
    periodId: string;
    groupId: string;
    status?: 'active' | 'inactive';
  }) {
    const { periodId, groupId } = params;
    const status = params.status ?? 'active';

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(groupId)) throw new BadRequestException('groupId inválido');

    const enrollRows = await this.enrollments.list({ periodId, groupId, status: 'active' });
    let studentIds = (enrollRows ?? []).map((e: any) => oid(e.studentId)).filter(Boolean);

    let studentsSource: 'enrollments' | 'students' = 'enrollments';

    if (studentIds.length === 0) {
      studentsSource = 'students';
      const studs = await this.students.findAll({ groupId, status: 'active' });
      studentIds = (studs ?? []).map((s: any) => oid(s._id)).filter(Boolean);
    }

    const classAssignments = await this.classAssignments.findAll({ periodId, groupId, status: 'active' });

    if (studentIds.length === 0) {
      return {
        ok: true,
        studentsSource,
        periodId,
        groupId,
        students: 0,
        classAssignments: classAssignments?.length ?? 0,
        attempted: 0,
        upserted: 0,
        matched: 0,
        modified: 0,
      };
    }

    if (!classAssignments || classAssignments.length === 0) {
      return {
        ok: true,
        studentsSource,
        periodId,
        groupId,
        students: studentIds.length,
        classAssignments: 0,
        attempted: 0,
        upserted: 0,
        matched: 0,
        modified: 0,
      };
    }

    const pid = new Types.ObjectId(periodId);

    const ops: any[] = [];
    for (const sid of studentIds) {
      const studentObjectId = new Types.ObjectId(sid);

      for (const ca of classAssignments as any[]) {
        const caId = oid(ca._id);
        const caGroupId = oid(ca.groupId);
        const caSubjectId = oid(ca.subjectId);
        const caTeacherId = oid(ca.teacherId);

        ops.push({
          updateOne: {
            filter: { periodId: pid, studentId: studentObjectId, classAssignmentId: new Types.ObjectId(caId) },
            update: {
              $set: { status },
              $setOnInsert: {
                periodId: pid,
                studentId: studentObjectId,
                classAssignmentId: new Types.ObjectId(caId),
                groupId: new Types.ObjectId(caGroupId),
                subjectId: new Types.ObjectId(caSubjectId),
                teacherId: new Types.ObjectId(caTeacherId),
              },
            },
            upsert: true,
          },
        });
      }
    }

    const res = await this.model.bulkWrite(ops, { ordered: false });

    return {
      ok: true,
      studentsSource,
      periodId,
      groupId,
      students: studentIds.length,
      classAssignments: classAssignments.length,
      attempted: ops.length,
      upserted: res.upsertedCount ?? 0,
      matched: res.matchedCount ?? 0,
      modified: res.modifiedCount ?? 0,
    };
  }
}
