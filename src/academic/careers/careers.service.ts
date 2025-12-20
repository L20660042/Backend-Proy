import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Career } from './schemas/career.schema';
import { CreateCareerDto } from './dto/create-career.dto';
import { UpdateCareerDto } from './dto/update-career.dto';

@Injectable()
export class CareersService {
  constructor(@InjectModel(Career.name) private model: Model<Career>) {}

  async create(dto: CreateCareerDto) {
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();

    try {
      return await this.model.create({
        name,
        code,
        divisionId: dto.divisionId?.trim() ?? null,
        status: dto.status ?? 'active',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El code de la carrera ya existe');
      }
      throw err;
    }
  }

  findAll() {
    return this.model.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Carrera no encontrada');
    return doc;
  }

  async update(id: string, dto: UpdateCareerDto) {
    const update: any = {};
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.code !== undefined) update.code = dto.code.trim().toUpperCase();
    if (dto.divisionId !== undefined) update.divisionId = dto.divisionId?.trim() ?? null;
    if (dto.status !== undefined) update.status = dto.status;

    try {
      const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
      if (!updated) throw new NotFoundException('Carrera no encontrada');
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El code de la carrera ya existe');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Carrera no encontrada');
    return { deleted: true };
  }
}
