import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Student } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(@InjectModel(Student.name) private model: Model<Student>) {}

  async create(dto: CreateStudentDto) {
    const controlNumber = dto.controlNumber.trim();
    const name = dto.name.trim();

    try {
      return await this.model.create({
        controlNumber,
        name,
        careerId: new Types.ObjectId(dto.careerId),
        groupId: dto.groupId ? new Types.ObjectId(dto.groupId) : null,
        status: dto.status ?? 'active',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El controlNumber del alumno ya existe');
      }
      throw err;
    }
  }

  findAll(params?: { careerId?: string; groupId?: string; status?: string }) {
    const filter: any = {};
    if (params?.careerId) filter.careerId = new Types.ObjectId(params.careerId);
    if (params?.groupId) filter.groupId = new Types.ObjectId(params.groupId);
    if (params?.status) filter.status = params.status;

    return this.model.find(filter).sort({ name: 1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Alumno no encontrado');
    return doc;
  }

  async update(id: string, dto: UpdateStudentDto) {
    const update: any = {};
    if (dto.controlNumber !== undefined) update.controlNumber = dto.controlNumber.trim();
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.careerId !== undefined) update.careerId = new Types.ObjectId(dto.careerId);
    if (dto.groupId !== undefined) update.groupId = dto.groupId ? new Types.ObjectId(dto.groupId) : null;
    if (dto.status !== undefined) update.status = dto.status;

    try {
      const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
      if (!updated) throw new NotFoundException('Alumno no encontrado');
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El controlNumber del alumno ya existe');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Alumno no encontrado');
    return { deleted: true };
  }
}
