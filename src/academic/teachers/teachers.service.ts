import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Teacher } from './schemas/teacher.schema';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(@InjectModel(Teacher.name) private model: Model<Teacher>) {}

  async create(dto: CreateTeacherDto) {
    const name = dto.name.trim();
    const employeeNumber = dto.employeeNumber.trim();

    try {
      return await this.model.create({
        name,
        employeeNumber,
        divisionId: dto.divisionId?.trim() ?? null,
        status: dto.status ?? 'active',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El employeeNumber del docente ya existe');
      }
      throw err;
    }
  }

  findAll(params?: { status?: string; divisionId?: string }) {
    const filter: any = {};
    if (params?.status) filter.status = params.status;
    if (params?.divisionId) filter.divisionId = params.divisionId;

    return this.model.find(filter).sort({ name: 1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Docente no encontrado');
    return doc;
  }

  async update(id: string, dto: UpdateTeacherDto) {
    const update: any = {};
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.employeeNumber !== undefined) update.employeeNumber = dto.employeeNumber.trim();
    if (dto.divisionId !== undefined) update.divisionId = dto.divisionId?.trim() ?? null;
    if (dto.status !== undefined) update.status = dto.status;

    try {
      const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
      if (!updated) throw new NotFoundException('Docente no encontrado');
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El employeeNumber del docente ya existe');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Docente no encontrado');
    return { deleted: true };
  }
}
