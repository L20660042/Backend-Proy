import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClassAssignmentsService } from '../class-assignments/class-assignments.service';
import { CreateCourseEnrollmentDto } from './dto/create-course-enrollment.dto';
import { UpdateCourseEnrollmentDto } from './dto/update-course-enrollment.dto';
import { CourseEnrollment, CourseEnrollmentDocument } from './schemas/course-enrollment.schema';

@Injectable()
export class CourseEnrollmentsService {
  constructor(
    @InjectModel(CourseEnrollment.name)
    private readonly model: Model<CourseEnrollmentDocument>,
    private readonly classAssignments: ClassAssignmentsService,
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
}
