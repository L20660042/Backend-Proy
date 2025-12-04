import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from './schemas/group.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(@InjectModel(Group.name) private groupModel: Model<GroupDocument>) {}

  /** Crear grupo */
  async create(dto: CreateGroupDto): Promise<GroupDocument> {
    const exists = await this.groupModel.findOne({ name: dto.name, subject: dto.subject });
    if (exists) throw new BadRequestException('El grupo ya existe para esta materia');

    const group = new this.groupModel(dto);
    return group.save();
  }

  /** Obtener todos los grupos */
  async findAll(): Promise<GroupDocument[]> {
    return this.groupModel
      .find()
      .populate('teacher')
      .populate('subject')
      .populate('students')
      .sort({ name: 1 })
      .exec();
  }

  /** Obtener un grupo por ID */
  async findOne(id: string): Promise<GroupDocument> {
    const group = await this.groupModel
      .findById(id)
      .populate('teacher')
      .populate('subject')
      .populate('students');

    if (!group) throw new NotFoundException('Grupo no encontrado');
    return group;
  }

  /** Actualizar grupo */
  async update(id: string, dto: UpdateGroupDto): Promise<GroupDocument> {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Grupo no encontrado');

    Object.assign(group, dto);
    return group.save();
  }

  /** Activar / desactivar grupo */
  async toggleActive(id: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Grupo no encontrado');

    group.active = !group.active;
    return group.save();
  }

  /** Eliminar grupo */
  async delete(id: string): Promise<any> {
    return this.groupModel.findByIdAndDelete(id);
  }

  /** Agregar estudiantes al grupo */
  async addStudents(groupId: string, studentIds: string[]): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Grupo no encontrado');

    if (!group.students) group.students = [];

    const newStudentIds = studentIds.map((id) => new Types.ObjectId(id));

    const allStudents = [...group.students.map((id) => id.toString()), ...studentIds];
    const uniqueStudents = [...new Set(allStudents)].map((id) => new Types.ObjectId(id));

    group.students = uniqueStudents;
    return group.save();
  }

  async removeStudents(groupId: string, studentIds: string[]): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Grupo no encontrado');
    if (!group.students) return group;

    group.students = group.students.filter((id) => !studentIds.includes(id.toString()));
    return group.save();
  }
 }
