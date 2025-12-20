import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Period } from './schemas/period.schema';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';

@Injectable()
export class PeriodsService {
  constructor(@InjectModel(Period.name) private model: Model<Period>) {}

  async create(dto: CreatePeriodDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('endDate no puede ser menor que startDate');

    return this.model.create({
      name: dto.name.trim(),
      startDate: start,
      endDate: end,
      isActive: dto.isActive ?? false,
    });
  }

  findAll() {
    return this.model.find().sort({ startDate: -1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Periodo no encontrado');
    return doc;
  }

  async update(id: string, dto: UpdatePeriodDto) {
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      if (end < start) throw new BadRequestException('endDate no puede ser menor que startDate');
    }
    const updated = await this.model.findByIdAndUpdate(
      id,
      {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      { new: true },
    ).exec();

    if (!updated) throw new NotFoundException('Periodo no encontrado');
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Periodo no encontrado');
    return { deleted: true };
  }
}
