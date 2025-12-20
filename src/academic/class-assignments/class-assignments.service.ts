import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClassAssignment } from './schemas/class-assignment.schema';
import { CreateClassAssignmentDto } from './dto/create-class-assignment.dto';
import { UpdateClassAssignmentDto } from './dto/update-class-assignment.dto';

@Injectable()
export class ClassAssignmentsService {
  constructor(@InjectModel(ClassAssignment.name) private model: Model<ClassAssignment>) {}

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
}
