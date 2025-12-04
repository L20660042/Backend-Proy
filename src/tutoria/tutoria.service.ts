import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tutoria, TutoriaDocument } from './schemas/tutoria.schema';
import { CreateTutoriaDto } from './dto/create-tutoria.dto';
import { UpdateTutoriaDto } from './dto/update-tutoria.dto';
import { ObjectId } from '../common/types';

@Injectable()
export class TutoriaService {
  constructor(@InjectModel(Tutoria.name) private tutoriaModel: Model<TutoriaDocument>) {}

  async create(dto: CreateTutoriaDto): Promise<TutoriaDocument> {
    const tutoria = new this.tutoriaModel({
      ...dto,
      tutor: new Types.ObjectId(dto.tutor),
      student: new Types.ObjectId(dto.student),
      group: new Types.ObjectId(dto.group),
      date: new Date(dto.date),
    });
    return tutoria.save();
  }

  async findAll(): Promise<TutoriaDocument[]> {
    return this.tutoriaModel
      .find()
      .populate('tutor')
      .populate('student')
      .populate('group')
      .sort({ date: -1 })
      .exec();
  }

  async findOne(id: string): Promise<TutoriaDocument> {
    const tutoria = await this.tutoriaModel
      .findById(id)
      .populate('tutor')
      .populate('student')
      .populate('group');
    if (!tutoria) throw new NotFoundException('Tutoría no encontrada');
    return tutoria;
  }

  async update(id: string, dto: UpdateTutoriaDto): Promise<TutoriaDocument> {
    const tutoria = await this.tutoriaModel.findById(id);
    if (!tutoria) throw new NotFoundException('Tutoría no encontrada');

    Object.assign(tutoria, dto);
    if (dto.tutor) tutoria.tutor = new Types.ObjectId(dto.tutor);
    if (dto.student) tutoria.student = new Types.ObjectId(dto.student);
    if (dto.group) tutoria.group = new Types.ObjectId(dto.group);
    if (dto.date) tutoria.date = new Date(dto.date);

    return tutoria.save();
  }

  async delete(id: string): Promise<any> {
    return this.tutoriaModel.findByIdAndDelete(id);
  }

  /** Buscar tutorías de un estudiante */
  async findByStudent(studentId: string): Promise<TutoriaDocument[]> {
    return this.tutoriaModel
      .find({ student: new Types.ObjectId(studentId) })
      .populate('tutor')
      .populate('group')
      .sort({ date: -1 })
      .exec();
  }

  /** Buscar tutorías de un tutor */
  async findByTutor(tutorId: string): Promise<TutoriaDocument[]> {
    return this.tutoriaModel
      .find({ tutor: new Types.ObjectId(tutorId) })
      .populate('student')
      .populate('group')
      .sort({ date: -1 })
      .exec();
  }

  /** Buscar tutorías por grupo */
  async findByGroup(groupId: string): Promise<TutoriaDocument[]> {
    return this.tutoriaModel
      .find({ group: new Types.ObjectId(groupId) })
      .populate('tutor')
      .populate('student')
      .sort({ date: -1 })
      .exec();
  }
}
