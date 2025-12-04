import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subject, SubjectDocument } from './schemas/subject.schema';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
@Injectable()
export class SubjectsService {
  constructor(@InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>) {}

  async create(dto: CreateSubjectDto): Promise<SubjectDocument> {
    const exists = await this.subjectModel.findOne({ code: dto.code });
    if (exists) throw new BadRequestException('La materia ya existe');

    const subject = new this.subjectModel(dto);
    return subject.save();
  }

  async findAll(): Promise<SubjectDocument[]> {
    return this.subjectModel.find().populate('teacher').sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<SubjectDocument> {
    const subject = await this.subjectModel.findById(id).populate('teacher');
    if (!subject) throw new NotFoundException('Materia no encontrada');
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<SubjectDocument> {
    const subject = await this.subjectModel.findById(id);
    if (!subject) throw new NotFoundException('Materia no encontrada');

    Object.assign(subject, dto);
    return subject.save();
  }

  async toggleActive(id: string): Promise<SubjectDocument> {
    const subject = await this.subjectModel.findById(id);
    if (!subject) throw new NotFoundException('Materia no encontrada');

    subject.active = !subject.active;
    return subject.save();
  }

  async delete(id: string): Promise<any> {
    return this.subjectModel.findByIdAndDelete(id);
  }
}
