import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group } from './schemas/group.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(@InjectModel(Group.name) private model: Model<Group>) {}

  async create(dto: CreateGroupDto) {
    const name = dto.name.trim().toUpperCase(); // opcional: normalizar
    try {
      return await this.model.create({
        name,
        careerId: new Types.ObjectId(dto.careerId),
        periodId: new Types.ObjectId(dto.periodId),
        semester: dto.semester,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('Ya existe un grupo con ese nombre para la carrera y periodo');
      }
      throw err;
    }
  }

  findAll(params?: { periodId?: string; careerId?: string }) {
    const filter: any = {};
    if (params?.periodId) filter.periodId = new Types.ObjectId(params.periodId);
    if (params?.careerId) filter.careerId = new Types.ObjectId(params.careerId);

    return this.model
      .find(filter)
      .sort({ semester: 1, name: 1 })
      .exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Grupo no encontrado');
    return doc;
  }

  async update(id: string, dto: UpdateGroupDto) {
    const update: any = {};
    if (dto.name !== undefined) update.name = dto.name.trim().toUpperCase();
    if (dto.careerId !== undefined) update.careerId = new Types.ObjectId(dto.careerId);
    if (dto.periodId !== undefined) update.periodId = new Types.ObjectId(dto.periodId);
    if (dto.semester !== undefined) update.semester = dto.semester;

    try {
      const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
      if (!updated) throw new NotFoundException('Grupo no encontrado');
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('Ya existe un grupo con ese nombre para la carrera y periodo');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Grupo no encontrado');
    return { deleted: true };
  }
}
