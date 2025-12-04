import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Capacitacion, CapacitacionDocument } from './schemas/capacitacion.schema';
import { CreateCapacitacionDto } from './dto/create-capacitacion.dto';
import { UpdateCapacitacionDto } from './dto/update-capacitacion.dto';
import { ObjectId } from '../common/types';

@Injectable()
export class CapacitacionService {
  constructor(@InjectModel(Capacitacion.name) private capacitacionModel: Model<CapacitacionDocument>) {}

  async create(dto: CreateCapacitacionDto): Promise<CapacitacionDocument> {
    const capacitacion = new this.capacitacionModel({
      ...dto,
      teacher: new Types.ObjectId(dto.teacher),
      date: new Date(dto.date),
      evidence: dto.evidence || [],
    });
    return capacitacion.save();
  }

  async findAll(): Promise<CapacitacionDocument[]> {
    return this.capacitacionModel
      .find()
      .populate('teacher')
      .sort({ date: -1 })
      .exec();
  }

  async findOne(id: string): Promise<CapacitacionDocument> {
    const capacitacion = await this.capacitacionModel
      .findById(id)
      .populate('teacher');
    if (!capacitacion) throw new NotFoundException('Capacitación no encontrada');
    return capacitacion;
  }

  async update(id: string, dto: UpdateCapacitacionDto): Promise<CapacitacionDocument> {
    const capacitacion = await this.capacitacionModel.findById(id);
    if (!capacitacion) throw new NotFoundException('Capacitación no encontrada');

    Object.assign(capacitacion, dto);
    if (dto.teacher) capacitacion.teacher = new Types.ObjectId(dto.teacher);
    if (dto.date) capacitacion.date = new Date(dto.date);
    if (dto.evidence) capacitacion.evidence = dto.evidence;

    return capacitacion.save();
  }

  async delete(id: string): Promise<any> {
    return this.capacitacionModel.findByIdAndDelete(id);
  }

  /** Buscar capacitaciones por docente */
  async findByTeacher(teacherId: string): Promise<CapacitacionDocument[]> {
    return this.capacitacionModel
      .find({ teacher: new Types.ObjectId(teacherId) })
      .populate('teacher')
      .sort({ date: -1 })
      .exec();
  }
}
