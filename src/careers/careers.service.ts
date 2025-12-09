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

  async create(dto: CreateCareerDto): Promise<any> {
    const exists = await this.careerModel.findOne({ 
      $or: [{ name: dto.name }, { code: dto.code }] 
    });
    if (exists) throw new BadRequestException('La carrera ya existe');

    const career = new this.careerModel(dto);
    await career.save();
    
    return {
      success: true,
      data: career,
      message: 'Carrera creada exitosamente'
    };
  }

  async findAll(): Promise<any> {
    const careers = await this.careerModel.find().sort({ name: 1 }).exec();
    
    // Mapear active a status para el frontend
    const mappedCareers = careers.map(career => ({
      ...career.toObject(),
      status: career.active ? 'active' : 'inactive'
    }));
    
    return {
      success: true,
      data: mappedCareers,
      message: 'Carreras obtenidas exitosamente'
    };
  }

  async findOne(id: string): Promise<any> {
    const career = await this.careerModel.findById(id);
    if (!career) throw new NotFoundException('Carrera no encontrada');
    
    return {
      success: true,
      data: {
        ...career.toObject(),
        status: career.active ? 'active' : 'inactive'
      }
    };
  }

  async update(id: string, dto: UpdateCareerDto): Promise<any> {
    const career = await this.careerModel.findById(id);
    if (!career) throw new NotFoundException('Carrera no encontrada');

    // Convertir status a active si viene del frontend
    // Nota: Esto ya se hace en el controlador, pero por si acaso
    if (dto.status) {
      dto.active = dto.status === 'active';
    }

    Object.assign(career, dto);
    await career.save();
    
    return {
      success: true,
      data: {
        ...career.toObject(),
        status: career.active ? 'active' : 'inactive'
      },
      message: 'Carrera actualizada exitosamente'
    };
  }

  async toggleActive(id: string): Promise<any> {
    const career = await this.careerModel.findById(id);
    if (!career) throw new NotFoundException('Carrera no encontrada');

    career.active = !career.active;
    await career.save();
    
    return {
      success: true,
      data: {
        ...career.toObject(),
        status: career.active ? 'active' : 'inactive'
      },
      message: `Carrera ${career.active ? 'activada' : 'desactivada'} exitosamente`
    };
  }

  async delete(id: string): Promise<any> {
    const result = await this.careerModel.findByIdAndDelete(id);
    
    if (!result) {
      throw new NotFoundException('Carrera no encontrada');
    }
    
    return {
      success: true,
      message: 'Carrera eliminada exitosamente'
    };
  }
  
async findByNameOrCode(identifier: string): Promise<any> {
  const career = await this.careerModel.findOne({
    $or: [
      { name: { $regex: `^${identifier}$`, $options: 'i' } },
      { code: { $regex: `^${identifier}$`, $options: 'i' } }
    ]
  }).exec();

  if (career) {
    return {
      success: true,
      data: {
        ...career.toObject(),
        status: career.active ? 'active' : 'inactive'
      }
    };
  }
  
  return { success: false, message: 'Carrera no encontrada' };
}
}