// src/academic/class-assignments/class-assignments.service.ts

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClassAssignment } from './schemas/class-assignment.schema';
import { CreateClassAssignmentDto } from './dto/create-class-assignment.dto';
import { UpdateClassAssignmentDto } from './dto/update-class-assignment.dto';
import { CourseEnrollment } from '../course-enrollments/schemas/course-enrollment.schema';

@Injectable()
export class ClassAssignmentsService {
  constructor(
    @InjectModel(ClassAssignment.name) private model: Model<ClassAssignment>,
    @InjectModel(CourseEnrollment.name) private ceModel: Model<CourseEnrollment>, // ✅ nuevo
  ) {}

  async create(dto: CreateClassAssignmentDto) {
    try {
      return await this.model.create({
        periodId: new Types.ObjectId(dto.periodId),
        careerId: new Types.ObjectId(dto.careerId),
        groupId: new Types.ObjectId(dto.groupId),
        subjectId: new Types.ObjectId(dto.subjectId),
        teacherId: new Types.ObjectId(dto.teacherId),
        status: dto.status ?? 'active',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('La materia ya está asignada a ese grupo en ese periodo');
      }
      throw err;
    }
  }

  findAll(params?: {
    periodId?: string;
    careerId?: string;
    groupId?: string;
    subjectId?: string;
    teacherId?: string;
    status?: string;
  }) {
    const filter: any = {};
    if (params?.periodId) filter.periodId = new Types.ObjectId(params.periodId);
    if (params?.careerId) filter.careerId = new Types.ObjectId(params.careerId);
    if (params?.groupId) filter.groupId = new Types.ObjectId(params.groupId);
    if (params?.subjectId) filter.subjectId = new Types.ObjectId(params.subjectId);
    if (params?.teacherId) filter.teacherId = new Types.ObjectId(params.teacherId);
    if (params?.status) filter.status = params.status;

    return this.model
      .find(filter)
      .populate('periodId', 'name')
      .populate('careerId', 'name code')
      .populate('groupId', 'name semester')
      .populate('subjectId', 'name code semester')
      .populate('teacherId', 'name employeeNumber')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    const doc = await this.model
      .findById(id)
      .populate('periodId', 'name')
      .populate('careerId', 'name code')
      .populate('groupId', 'name semester')
      .populate('subjectId', 'name code semester')
      .populate('teacherId', 'name employeeNumber')
      .exec();

    if (!doc) throw new NotFoundException('Asignación no encontrada');
    return doc;
  }

  async update(id: string, dto: UpdateClassAssignmentDto) {
    const update: any = {};
    if (dto.periodId !== undefined) update.periodId = new Types.ObjectId(dto.periodId);
    if (dto.careerId !== undefined) update.careerId = new Types.ObjectId(dto.careerId);
    if (dto.groupId !== undefined) update.groupId = new Types.ObjectId(dto.groupId);
    if (dto.subjectId !== undefined) update.subjectId = new Types.ObjectId(dto.subjectId);
    if (dto.teacherId !== undefined) update.teacherId = new Types.ObjectId(dto.teacherId);
    if (dto.status !== undefined) update.status = dto.status;

    try {
      const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
      if (!updated) throw new NotFoundException('Asignación no encontrada');
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('La materia ya está asignada a ese grupo en ese periodo');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Asignación no encontrada');
    return { deleted: true };
  }

  async findGroupSummary(params: {
    periodId: string;
    groupId: string;
    careerId?: string;
    status?: string; // default active
  }) {
    const { periodId, groupId, careerId } = params;
    const status = params.status ?? 'active';

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(groupId)) throw new BadRequestException('groupId inválido');
    if (careerId && !Types.ObjectId.isValid(careerId)) throw new BadRequestException('careerId inválido');

    const filter: any = {
      periodId: new Types.ObjectId(periodId),
      groupId: new Types.ObjectId(groupId),
    };
    if (careerId) filter.careerId = new Types.ObjectId(careerId);
    if (status) filter.status = status;

    const classAssignments = await this.model
      .find(filter)
      .populate('periodId', 'name')
      .populate('careerId', 'name code')
      .populate('groupId', 'name semester')
      .populate('subjectId', 'name code semester')
      .populate('teacherId', 'name employeeNumber')
      .sort({ createdAt: 1 })
      .lean();

    if (!classAssignments.length) return [];

    const ids = classAssignments.map((ca: any) => new Types.ObjectId(String(ca._id)));
    const pid = new Types.ObjectId(periodId);

    const rows = await this.ceModel.aggregate([
      {
        $match: {
          periodId: pid,
          status: 'active',
          classAssignmentId: { $in: ids },
        },
      },
      { $group: { _id: '$classAssignmentId', count: { $sum: 1 } } },
    ]);

    const map = new Map<string, number>();
    for (const r of rows) map.set(String(r._id), Number(r.count ?? 0));

    return classAssignments.map((ca: any) => ({
      ...ca,
      enrolledCount: map.get(String(ca._id)) ?? 0,
    }));
  }
}
