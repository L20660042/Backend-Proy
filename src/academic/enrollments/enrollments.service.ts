import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Enrollment } from './schemas/enrollment.schema';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  [x: string]: any;
  constructor(@InjectModel(Enrollment.name) private model: Model<Enrollment>) {}

  async create(dto: CreateEnrollmentDto) {
    try {
      return await this.model.create({
        periodId: new Types.ObjectId(dto.periodId),
        studentId: new Types.ObjectId(dto.studentId),
        groupId: new Types.ObjectId(dto.groupId),
        status: dto.status ?? 'active',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El alumno ya está inscrito en ese periodo');
      }
      throw err;
    }
  }

  findAll(params?: { periodId?: string; groupId?: string; studentId?: string; status?: string }) {
    const filter: any = {};
    if (params?.periodId) filter.periodId = new Types.ObjectId(params.periodId);
    if (params?.groupId) filter.groupId = new Types.ObjectId(params.groupId);
    if (params?.studentId) filter.studentId = new Types.ObjectId(params.studentId);
    if (params?.status) filter.status = params.status;

    return this.model
      .find(filter)
      .populate('studentId', 'name controlNumber')
      .populate('groupId', 'name semester careerId periodId')
      .populate('periodId', 'name startDate endDate isActive')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    const doc = await this.model
      .findById(id)
      .populate('studentId', 'name controlNumber')
      .populate('groupId', 'name semester careerId periodId')
      .populate('periodId', 'name startDate endDate isActive')
      .exec();

    if (!doc) throw new NotFoundException('Inscripción no encontrada');
    return doc;
  }

  async update(id: string, dto: UpdateEnrollmentDto) {
    const update: any = {};
    if (dto.periodId !== undefined) update.periodId = new Types.ObjectId(dto.periodId);
    if (dto.studentId !== undefined) update.studentId = new Types.ObjectId(dto.studentId);
    if (dto.groupId !== undefined) update.groupId = new Types.ObjectId(dto.groupId);
    if (dto.status !== undefined) update.status = dto.status;

    try {
      const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
      if (!updated) throw new NotFoundException('Inscripción no encontrada');
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El alumno ya está inscrito en ese periodo');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Inscripción no encontrada');
    return { deleted: true };
  }
  async findActiveByStudentAndPeriod(periodId: string, studentId: string) {
  return this.model
    .findOne({
      periodId: new Types.ObjectId(periodId),
      studentId: new Types.ObjectId(studentId),
      status: 'active',
    })
    .exec();
}

}
