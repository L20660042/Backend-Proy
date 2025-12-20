import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subject } from './schemas/subject.schema';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(@InjectModel(Subject.name) private model: Model<Subject>) {}

  async create(dto: CreateSubjectDto) {
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();

    try {
      return await this.model.create({
        name,
        code,
        careerId: new Types.ObjectId(dto.careerId),
        semester: dto.semester,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El code de la materia ya existe');
      }
      throw err;
    }
  }

  findAll(params?: { careerId?: string; semester?: string }) {
    const filter: any = {};
    if (params?.careerId) filter.careerId = new Types.ObjectId(params.careerId);
    if (params?.semester) filter.semester = Number(params.semester);

    return this.model.find(filter).sort({ semester: 1, name: 1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Materia no encontrada');
    return doc;
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const update: any = {};
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.code !== undefined) update.code = dto.code.trim().toUpperCase();
    if (dto.careerId !== undefined) update.careerId = new Types.ObjectId(dto.careerId);
    if (dto.semester !== undefined) update.semester = dto.semester;

    try {
      const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
      if (!updated) throw new NotFoundException('Materia no encontrada');
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El code de la materia ya existe');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Materia no encontrada');
    return { deleted: true };
  }
}
