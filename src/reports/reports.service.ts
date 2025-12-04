import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tutoria, TutoriaDocument } from '../tutoria/schemas/tutoria.schema';
import { Capacitacion, CapacitacionDocument } from '../capacitacion/schemas/capacitacion.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { Career, CareerDocument } from '../careers/schemas/career.schema';
import { GetReportsDto } from './dto/get-reports.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Tutoria.name) private tutoriaModel: Model<TutoriaDocument>,
    @InjectModel(Capacitacion.name) private capacitacionModel: Model<CapacitacionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
    @InjectModel(Career.name) private careerModel: Model<CareerDocument>,
  ) {}

  /** Generar reportes filtrados */
  async generate(dto: GetReportsDto): Promise<any> {
    const { type } = dto;

    switch (type) {
      case 'tutoria':
        return this.getTutoriaReport(dto);
      case 'capacitacion':
        return this.getCapacitacionReport(dto);
      case 'usuarios':
        return this.getUsersReport(dto);
      case 'grupos':
        return this.getGroupsReport(dto);
      case 'materias':
        return this.getSubjectsReport(dto);
      default:
        return {
          tutorias: await this.getTutoriaReport(dto),
          capacitaciones: await this.getCapacitacionReport(dto),
          usuarios: await this.getUsersReport(dto),
          grupos: await this.getGroupsReport(dto),
          materias: await this.getSubjectsReport(dto),
        };
    }
  }

  private async getTutoriaReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.userId) filter.tutor = new Types.ObjectId(dto.userId);
    if (dto.studentId) filter.student = new Types.ObjectId(dto.studentId);
    if (dto.groupId) filter.group = new Types.ObjectId(dto.groupId);
    if (dto.startDate || dto.endDate) filter.date = {};
    if (dto.startDate) filter.date.$gte = new Date(dto.startDate);
    if (dto.endDate) filter.date.$lte = new Date(dto.endDate);

    return this.tutoriaModel.find(filter)
      .populate('tutor')
      .populate('student')
      .populate('group')
      .sort({ date: -1 })
      .exec();
  }

  private async getCapacitacionReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.userId) filter.teacher = new Types.ObjectId(dto.userId);
    if (dto.startDate || dto.endDate) filter.date = {};
    if (dto.startDate) filter.date.$gte = new Date(dto.startDate);
    if (dto.endDate) filter.date.$lte = new Date(dto.endDate);

    return this.capacitacionModel.find(filter)
      .populate('teacher')
      .sort({ date: -1 })
      .exec();
  }

  private async getUsersReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.userId) filter._id = new Types.ObjectId(dto.userId);
    return this.userModel.find(filter).sort({ name: 1 }).exec();
  }

  private async getGroupsReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.groupId) filter._id = new Types.ObjectId(dto.groupId);
    if (dto.subjectId) filter.subject = new Types.ObjectId(dto.subjectId);
    if (dto.careerId) filter.career = new Types.ObjectId(dto.careerId);
    return this.groupModel.find(filter)
      .populate('teacher')
      .populate('subject')
      .populate('students')
      .sort({ name: 1 })
      .exec();
  }

  private async getSubjectsReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.subjectId) filter._id = new Types.ObjectId(dto.subjectId);
    if (dto.careerId) filter.career = new Types.ObjectId(dto.careerId);
    return this.subjectModel.find(filter)
      .populate('career')
      .sort({ name: 1 })
      .exec();
  }
}
