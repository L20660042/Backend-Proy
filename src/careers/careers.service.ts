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
    // Verificar duplicados
    const exists = await this.careerModel.findOne({ 
      $or: [
        { name: { $regex: `^${dto.name}$`, $options: 'i' } }, 
        { code: { $regex: `^${dto.code}$`, $options: 'i' } }
      ] 
    });
    
    if (exists) {
      throw new BadRequestException('La carrera ya existe (nombre o código duplicado)');
    }

    const career = new this.careerModel(dto);
    await career.save();
    
    return {
      success: true,
      data: career,
      message: 'Carrera creada exitosamente'
    };
  }

  async createSimple(createCareerDto: any): Promise<CareerDocument> {
    // Método simplificado para ExcelService
    const career = new this.careerModel(createCareerDto);
    return career.save();
  }

  async findAll(): Promise<any> {
    const careers = await this.careerModel.find().sort({ name: 1 }).exec();
    
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

  async findAllSimple(): Promise<CareerDocument[]> {
    // Método simplificado para ExcelService
    return this.careerModel.find().sort({ name: 1 }).exec();
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

  async findOneSimple(id: string): Promise<CareerDocument | null> {
    // Método simplificado para ExcelService
    return this.careerModel.findById(id).exec();
  }

  async update(id: string, dto: UpdateCareerDto): Promise<any> {
    const career = await this.careerModel.findById(id);
    if (!career) throw new NotFoundException('Carrera no encontrada');

    // Si viene status, convertirlo a active
    if ('status' in dto) {
      dto.active = dto.status === 'active';
      delete dto.status;
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

  async updateSimple(id: string, updateData: any): Promise<CareerDocument | null> {
    // Método simplificado para ExcelService
    return this.careerModel.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    ).exec();
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

  async findByCode(code: string): Promise<CareerDocument | null> {
    return this.careerModel.findOne({ 
      code: { $regex: `^${code}$`, $options: 'i' } 
    }).exec();
  }

  async findByName(name: string): Promise<CareerDocument | null> {
    return this.careerModel.findOne({ 
      name: { $regex: `^${name}$`, $options: 'i' } 
    }).exec();
  }
}