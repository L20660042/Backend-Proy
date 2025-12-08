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

  // Verificar que el ID de carrera sea válido
  if (!Types.ObjectId.isValid(dto.career)) {
    throw new BadRequestException('ID de carrera inválido');
  }

  const subject = new this.subjectModel({
    ...dto,
    career: new Types.ObjectId(dto.career) // Convertir string a ObjectId
  });
  
  const savedSubject = await subject.save();
  
  // Populate para obtener datos relacionados
  const populatedSubject = await this.subjectModel
    .findById(savedSubject._id)
    .populate('career', 'name code')
    .populate('teacher', 'fullName email')
    .exec();

  // Validar que populatedSubject no sea null
  if (!populatedSubject) {
    throw new NotFoundException('Materia no encontrada después de crear');
  }

  return {
    success: true,
    data: {
      ...populatedSubject.toObject(),
      status: populatedSubject.active ? 'active' : 'inactive',
      careerId: dto.career, // Mantener el ID original como string
      careerName: (populatedSubject.career as any)?.['name'] || 'Desconocida'
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
      careerId: (subject.career as any)?.['_id']?.toString(),
      careerName: (subject.career as any)?.['name'] || 'Desconocida',
      teacherName: (subject.teacher as any)?.['fullName'] || 'Sin asignar'
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
        careerId: (subject.career as any)?.['_id']?.toString(),
        careerName: (subject.career as any)?.['name'] || 'Desconocida',
        teacherName: (subject.teacher as any)?.['fullName'] || 'Sin asignar'
      }
    };
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<any> {
  const subject = await this.subjectModel.findById(id);
  if (!subject) {
    throw new NotFoundException('Materia no encontrada');
  }

  // Convertir status a active si viene del frontend
  if (dto.status) {
    dto.active = dto.status === 'active';
    delete dto.status;
  }

  // Si viene career (como string), convertirlo a ObjectId
  if (dto.career && typeof dto.career === 'string') {
    if (!Types.ObjectId.isValid(dto.career)) {
      throw new BadRequestException('ID de carrera inválido');
    }
    dto.career = new Types.ObjectId(dto.career) as any;
  }

  Object.assign(subject, dto);
  await subject.save();

  // Obtener datos actualizados con populate
  const updatedSubject = await this.subjectModel
    .findById(id)
    .populate('career', 'name code')
    .populate('teacher', 'fullName email')
    .exec();

  if (!updatedSubject) {
    throw new NotFoundException('Materia no encontrada después de actualizar');
  }

  return {
    success: true,
    data: {
      ...updatedSubject.toObject(),
      status: updatedSubject.active ? 'active' : 'inactive',
      careerId: (updatedSubject.career as any)?.['_id']?.toString(),
      careerName: (updatedSubject.career as any)?.['name'] || 'Desconocida',
      teacherName: (updatedSubject.teacher as any)?.['fullName'] || 'Sin asignar'
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