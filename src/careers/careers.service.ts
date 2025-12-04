import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Career, CareerDocument } from './schemas/career.schema';
import { CreateCareerDto } from './dto/create-career.dto';
import { UpdateCareerDto } from './dto/update-career.dto';

@Injectable()
export class CareersService {
  constructor(
    @InjectModel(Career.name) private careerModel: Model<CareerDocument>,
  ) {}

  async create(dto: CreateCareerDto): Promise<CareerDocument> {
    const exists = await this.careerModel.findOne({ $or: [{ name: dto.name }, { code: dto.code }] });
    if (exists) throw new BadRequestException('La carrera ya existe');

    const career = new this.careerModel(dto);
    return career.save();
  }

  async findAll(): Promise<CareerDocument[]> {
    return this.careerModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<CareerDocument> {
    const career = await this.careerModel.findById(id);
    if (!career) throw new NotFoundException('Carrera no encontrada');
    return career;
  }

  async update(id: string, dto: UpdateCareerDto): Promise<CareerDocument> {
    const career = await this.careerModel.findById(id);
    if (!career) throw new NotFoundException('Carrera no encontrada');

    Object.assign(career, dto);
    return career.save();
  }

  async toggleActive(id: string): Promise<CareerDocument> {
    const career = await this.careerModel.findById(id);
    if (!career) throw new NotFoundException('Carrera no encontrada');

    career.active = !career.active;
    return career.save();
  }

  async delete(id: string): Promise<any> {
    return this.careerModel.findByIdAndDelete(id);
  }
}
