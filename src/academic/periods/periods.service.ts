import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Period } from './schemas/period.schema';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';

@Injectable()
export class PeriodsService {
  constructor(@InjectModel(Period.name) private readonly model: Model<Period>) {}

  async create(dto: CreatePeriodDto) {
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('name requerido');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (Number.isNaN(start.getTime())) throw new BadRequestException('startDate inválido');
    if (Number.isNaN(end.getTime())) throw new BadRequestException('endDate inválido');
    if (end < start) throw new BadRequestException('endDate no puede ser menor que startDate');

    const isActive = dto.isActive ?? false;

    // REGLA: si el nuevo periodo se marca activo, desactiva los demás
    if (isActive) {
      await this.model.updateMany({}, { $set: { isActive: false } }).exec();
    }

    return this.model.create({
      name,
      startDate: start,
      endDate: end,
      isActive,
    });
  }

  async findAll() {
    return this.model.find().sort({ startDate: -1 }).exec();
  }

  async findActive() {
    // devuelve el más reciente activo (o null si no hay)
    return this.model.findOne({ isActive: true }).sort({ startDate: -1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Periodo no encontrado');
    return doc;
  }

  async update(id: string, dto: UpdatePeriodDto) {
    const update: any = {};

    if (dto.name !== undefined) {
      const name = String(dto.name ?? '').trim();
      if (!name) throw new BadRequestException('name requerido');
      update.name = name;
    }

    if (dto.startDate !== undefined) {
      const start = new Date(dto.startDate);
      if (Number.isNaN(start.getTime())) throw new BadRequestException('startDate inválido');
      update.startDate = start;
    }

    if (dto.endDate !== undefined) {
      const end = new Date(dto.endDate);
      if (Number.isNaN(end.getTime())) throw new BadRequestException('endDate inválido');
      update.endDate = end;
    }

    // Validación rango fechas si llegan ambas (ya sea en dto o combinadas)
    if (update.startDate || update.endDate) {
      const current = await this.model.findById(id).exec();
      if (!current) throw new NotFoundException('Periodo no encontrado');

      const start = update.startDate ?? current.startDate;
      const end = update.endDate ?? current.endDate;

      if (end < start) throw new BadRequestException('endDate no puede ser menor que startDate');
    }

    if (dto.isActive !== undefined) {
      update.isActive = dto.isActive;

      // REGLA: si este periodo se pone activo, desactiva todos los demás
      if (dto.isActive === true) {
        await this.model.updateMany({ _id: { $ne: id } }, { $set: { isActive: false } }).exec();
      }
    }

    const updated = await this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();

    if (!updated) throw new NotFoundException('Periodo no encontrado');
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Periodo no encontrado');
    return { deleted: true };
  }
}
