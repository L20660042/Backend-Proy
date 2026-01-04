import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity, ActivityDocument } from './schemas/activity.schema';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name)
    private readonly model: Model<ActivityDocument>,
  ) {}

  async create(dto: CreateActivityDto) {
    if (!dto.periodId) throw new BadRequestException('periodId requerido');
    if (!dto.name?.trim()) throw new BadRequestException('name requerido');
    if (!dto.type?.trim()) throw new BadRequestException('type requerido');

    return this.model.create({
      periodId: new Types.ObjectId(dto.periodId),
      name: dto.name.trim(),
      type: dto.type.trim(),
      responsibleName: dto.responsibleName?.trim() ?? null,
      capacity: dto.capacity ?? null,
      status: dto.status ?? 'active',
    });
  }

  findAll(params?: { periodId?: string; status?: string }) {
    const filter: any = {};
    if (params?.periodId) filter.periodId = new Types.ObjectId(params.periodId);
    if (params?.status) filter.status = params.status;

    return this.model
      .find(filter)
      .populate('periodId', 'name')
      .sort({ name: 1 })
      .exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).populate('periodId', 'name').exec();
    if (!doc) throw new NotFoundException('Actividad no encontrada');
    return doc;
  }

  async update(id: string, dto: UpdateActivityDto) {
    const current = await this.model.findById(id).exec();
    if (!current) throw new NotFoundException('Actividad no encontrada');

    const patch: any = {};
    if (dto.periodId !== undefined) patch.periodId = new Types.ObjectId(dto.periodId);
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.type !== undefined) patch.type = dto.type.trim();
    if (dto.responsibleName !== undefined) patch.responsibleName = dto.responsibleName?.trim() ?? null;
    if (dto.capacity !== undefined) patch.capacity = dto.capacity ?? null;
    if (dto.status !== undefined) patch.status = dto.status;

    const updated = await this.model.findByIdAndUpdate(id, patch, { new: true }).exec();
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Actividad no encontrada');
    return { deleted: true };
  }
}
