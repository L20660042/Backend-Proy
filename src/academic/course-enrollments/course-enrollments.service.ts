import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ClassAssignmentsService } from '../class-assignments/class-assignments.service';
import { StudentsService } from '../students/students.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

import { CreateCourseEnrollmentDto } from './dto/create-course-enrollment.dto';
import { UpdateCourseEnrollmentDto } from './dto/update-course-enrollment.dto';
import { CourseEnrollment, CourseEnrollmentDocument } from './schemas/course-enrollment.schema';

function oid(id: any) {
  return String((id as any)?._id ?? id ?? '');
}

@Injectable()
export class CourseEnrollmentsService {
  constructor(
    @InjectModel(CourseEnrollment.name)
    private readonly model: Model<CourseEnrollmentDocument>,
    private readonly classAssignments: ClassAssignmentsService,
    private readonly students: StudentsService,
    private readonly enrollments: EnrollmentsService,
  ) {}

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

    // Validar que la carga exista y pertenezca al periodo
    const ca = await this.classAssignments.findOne(classAssignmentId);
    if (!ca) throw new NotFoundException('Asignación (classAssignment) no encontrada');

    if (String((ca as any).periodId?._id ?? (ca as any).periodId) !== String(periodId)) {
      throw new BadRequestException('La asignación no pertenece al periodId indicado');
    }

    try {
      return await this.model.create({
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(studentId),
        classAssignmentId: new Types.ObjectId(classAssignmentId),

        groupId: new Types.ObjectId(String((ca as any).groupId?._id ?? (ca as any).groupId)),
        subjectId: new Types.ObjectId(String((ca as any).subjectId?._id ?? (ca as any).subjectId)),
        teacherId: new Types.ObjectId(String((ca as any).teacherId?._id ?? (ca as any).teacherId)),

        status: dto.status ?? 'active',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El alumno ya está inscrito a esa materia (carga) en ese periodo');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateCourseEnrollmentDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');

    const update: any = {};
    if (dto.status !== undefined) update.status = dto.status;

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

  /**
   * ✅ Bulk: Grupo (del periodo) → todas las cargas activas del grupo
   * Fuente de alumnos:
   *  1) Primero Enrollment (Alumno→Grupo por periodo) si hay registros
   *  2) Si no hay, fallback a Student.groupId (útil si cargaste alumnos por CSV y no usas Enrollment)
   */
  async bulkEnrollByGroup(params: {
    periodId: string;
    groupId: string;
    status?: 'active' | 'inactive';
  }) {
    const { periodId, groupId } = params;
    const status = params.status ?? 'active';

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(groupId)) throw new BadRequestException('groupId inválido');

    // 1) alumnos: intentar por Enrollment (periodo+grupo)
    const enrollRows = await this.enrollments.list({ periodId, groupId, status: 'active' });
    let studentIds = (enrollRows ?? [])
      .map((e: any) => oid(e.studentId))
      .filter(Boolean);

    let studentsSource: 'enrollments' | 'students' = 'enrollments';

    // 2) fallback a Student.groupId
    if (studentIds.length === 0) {
      studentsSource = 'students';
      const studs = await this.students.findAll({ groupId, status: 'active' });
      studentIds = (studs ?? []).map((s: any) => oid(s._id)).filter(Boolean);
    }

    // 3) cargas activas del grupo en el periodo
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

    // 4) bulk upsert
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
            filter: {
              periodId: pid,
              studentId: studentObjectId,
              classAssignmentId: new Types.ObjectId(caId),
            },
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
