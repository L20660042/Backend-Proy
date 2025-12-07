import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subject, SubjectDocument } from './schemas/subject.schema';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
  ) {}

  async create(dto: CreateSubjectDto): Promise<any> {
    // Verificar si el código ya existe
    const exists = await this.subjectModel.findOne({ code: dto.code });
    if (exists) {
      throw new BadRequestException('El código de materia ya existe');
    }

    // Verificar que la carrera exista (opcional, pero buena práctica)
    if (!Types.ObjectId.isValid(dto.career)) {
      throw new BadRequestException('ID de carrera inválido');
    }

    const subject = new this.subjectModel({
      ...dto,
      career: new Types.ObjectId(dto.career)
    });
    
    await subject.save();
    
    // Populate para obtener datos relacionados
    const populatedSubject = await this.subjectModel
      .findById(subject._id)
      .populate('career', 'name code')
      .populate('teacher', 'fullName email')
      .exec();

    return {
      success: true,
      data: {
        ...populatedSubject.toObject(),
        status: populatedSubject.active ? 'active' : 'inactive',
        careerId: dto.career,
        careerName: populatedSubject.career?.['name'] || 'Desconocida'
      },
      message: 'Materia creada exitosamente'
    };
  }

  async findAll(): Promise<any> {
    const subjects = await this.subjectModel
      .find()
      .populate('career', 'name code')
      .populate('teacher', 'fullName email')
      .sort({ name: 1 })
      .exec();

    const mappedSubjects = subjects.map(subject => ({
      ...subject.toObject(),
      status: subject.active ? 'active' : 'inactive',
      careerId: subject.career?.['_id']?.toString(),
      careerName: subject.career?.['name'] || 'Desconocida',
      teacherName: subject.teacher?.['fullName'] || 'Sin asignar'
    }));

    return {
      success: true,
      data: mappedSubjects,
      message: 'Materias obtenidas exitosamente'
    };
  }

  async findOne(id: string): Promise<any> {
    const subject = await this.subjectModel
      .findById(id)
      .populate('career', 'name code')
      .populate('teacher', 'fullName email')
      .exec();

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    return {
      success: true,
      data: {
        ...subject.toObject(),
        status: subject.active ? 'active' : 'inactive',
        careerId: subject.career?.['_id']?.toString(),
        careerName: subject.career?.['name'] || 'Desconocida',
        teacherName: subject.teacher?.['fullName'] || 'Sin asignar'
      }
    };
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<any> {
    const subject = await this.subjectModel.findById(id);
    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    // Convertir status a active si viene del frontend
    if ((dto as any).status) {
      (dto as any).active = (dto as any).status === 'active';
      delete (dto as any).status;
    }

    // Convertir careerId a career si viene del frontend
    if ((dto as any).careerId) {
      (dto as any).career = new Types.ObjectId((dto as any).careerId);
      delete (dto as any).careerId;
    }

    Object.assign(subject, dto);
    await subject.save();

    // Obtener datos actualizados con populate
    const updatedSubject = await this.subjectModel
      .findById(id)
      .populate('career', 'name code')
      .populate('teacher', 'fullName email')
      .exec();

    return {
      success: true,
      data: {
        ...updatedSubject.toObject(),
        status: updatedSubject.active ? 'active' : 'inactive',
        careerId: updatedSubject.career?.['_id']?.toString(),
        careerName: updatedSubject.career?.['name'] || 'Desconocida',
        teacherName: updatedSubject.teacher?.['fullName'] || 'Sin asignar'
      },
      message: 'Materia actualizada exitosamente'
    };
  }

  async toggleActive(id: string): Promise<any> {
    const subject = await this.subjectModel.findById(id);
    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    subject.active = !subject.active;
    await subject.save();

    return {
      success: true,
      data: {
        ...subject.toObject(),
        status: subject.active ? 'active' : 'inactive'
      },
      message: `Materia ${subject.active ? 'activada' : 'desactivada'} exitosamente`
    };
  }

  async delete(id: string): Promise<any> {
    const result = await this.subjectModel.findByIdAndDelete(id);
    
    if (!result) {
      throw new NotFoundException('Materia no encontrada');
    }
    
    return {
      success: true,
      message: 'Materia eliminada exitosamente'
    };
  }
}