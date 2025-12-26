import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { Enrollment, EnrollmentDocument } from './schemas/enrollment.schema';

@Injectable()
export class EnrollmentsService {
  constructor(@InjectModel(Enrollment.name) private readonly model: Model<EnrollmentDocument>) {}

  async list(params?: { periodId?: string; groupId?: string; studentId?: string; status?: string }) {
    const filter: any = {};
    if (params?.periodId) filter.periodId = new Types.ObjectId(params.periodId);
    if (params?.groupId) filter.groupId = new Types.ObjectId(params.groupId);
    if (params?.studentId) filter.studentId = new Types.ObjectId(params.studentId);
    if (params?.status) filter.status = params.status;

    return this.model
      .find(filter)
      .populate('studentId')
      .populate('groupId')
      .populate('periodId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(dto: CreateEnrollmentDto) {
    const periodId = dto.periodId;
    const studentId = dto.studentId;
    const groupId = dto.groupId;

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('studentId inválido');
    if (!Types.ObjectId.isValid(groupId)) throw new BadRequestException('groupId inválido');

    try {
      const doc = await this.model.create({
        periodId,
        studentId,
        groupId,
        status: dto.status ?? 'active',
      });
      return doc;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El alumno ya está inscrito en ese periodo');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateEnrollmentDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');

    const update: any = {};
    if (dto.groupId) {
      if (!Types.ObjectId.isValid(dto.groupId)) throw new BadRequestException('groupId inválido');
      update.groupId = dto.groupId;
    }
    if (dto.status) update.status = dto.status;

    const doc = await this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate('studentId')
      .populate('groupId')
      .populate('periodId')
      .lean();

    if (!doc) throw new NotFoundException('Inscripción no encontrada');
    return doc;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');
    const doc = await this.model.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundException('Inscripción no encontrada');
    return { ok: true };
  }

  async findActiveByStudentAndPeriod(periodId: string, studentId: string) {
  if (!Types.ObjectId.isValid(periodId) || !Types.ObjectId.isValid(studentId)) return null;

  return this.model.findOne({
    periodId: new Types.ObjectId(periodId),
    studentId: new Types.ObjectId(studentId),
    status: 'active',
  }).lean();
}
}
