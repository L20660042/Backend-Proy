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
  async create(dto: CreateGroupDto | any): Promise<GroupDocument> {
    // Verificar si el código ya existe (si se proporciona)
    if (dto.code) {
      const exists = await this.groupModel.findOne({ 
        code: { $regex: `^${dto.code}$`, $options: 'i' } 
      });
      if (exists) throw new BadRequestException('El código de grupo ya existe');
    }

    // Verificar si el nombre ya existe para esta materia
    const nameExists = await this.groupModel.findOne({ 
      name: { $regex: `^${dto.name}$`, $options: 'i' }, 
      subject: dto.subject 
    });
    
    if (nameExists) {
      throw new BadRequestException('Ya existe un grupo con este nombre para la materia');
    }

    const group = new this.groupModel(dto);
    return group.save();
  }

  async createSimple(groupData: any): Promise<GroupDocument> {
    // Método simplificado para ExcelService
    const group = new this.groupModel(groupData);
    return group.save();
  }

  /** Obtener todos los grupos */
  async findAll(): Promise<GroupDocument[]> {
    return this.groupModel
      .find()
      .populate('teacher', 'firstName lastName email fullName')
      .populate('subject', 'name code')
      .populate('career', 'name code')
      .populate('students', 'firstName lastName email fullName')
      .sort({ name: 1 })
      .exec();
  }

  async findAllSimple(): Promise<GroupDocument[]> {
    // Método simplificado para ExcelService
    return this.groupModel.find().populate('subject').populate('career').exec();
  }

  /** Obtener un grupo por ID */
  async findOne(id: string): Promise<GroupDocument> {
    const group = await this.groupModel
      .findById(id)
      .populate('teacher', 'firstName lastName email fullName')
      .populate('subject', 'name code')
      .populate('career', 'name code')
      .populate('students', 'firstName lastName email fullName');

    if (!group) throw new NotFoundException('Grupo no encontrado');
    return group;
  }

  async findOneSimple(id: string): Promise<GroupDocument | null> {
    return this.groupModel.findById(id).populate('subject').populate('career').exec();
  }

  /** Actualizar grupo */
  async update(id: string, dto: UpdateGroupDto | any): Promise<GroupDocument> {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Grupo no encontrado');

    // Verificar si el código ya existe (si se está actualizando)
    if (dto.code && dto.code !== group.code) {
      const codeExists = await this.groupModel.findOne({ 
        code: { $regex: `^${dto.code}$`, $options: 'i' },
        _id: { $ne: id }
      });
      if (codeExists) throw new BadRequestException('El código de grupo ya existe');
    }

    Object.assign(group, dto);
    return group.save();
  }

  async updateSimple(id: string, updateData: any): Promise<GroupDocument | null> {
    return this.groupModel.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    ).exec();
  }

  /** Activar / desactivar grupo */
  async toggleActive(id: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Grupo no encontrado');

    group.active = !group.active;
    return group.save();
  }

  /** Eliminar grupo */
  async delete(id: string): Promise<GroupDocument | null> {
    return this.groupModel.findByIdAndDelete(id);
  }

  /** Agregar estudiantes al grupo */
  async addStudents(groupId: string, studentIds: string[]): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Grupo no encontrado');

    // Convertir studentIds a ObjectId
    const objectIds = studentIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    // Agregar estudiantes únicos
    const existingIds = group.students ? group.students.map(id => id.toString()) : [];
    const newIds = objectIds
      .filter(id => !existingIds.includes(id.toString()))
      .map(id => id);

    if (group.students) {
      group.students = [...group.students, ...newIds];
    } else {
      group.students = newIds;
    }

    return group.save();
  }

  /** Remover estudiantes del grupo */
  async removeStudents(groupId: string, studentIds: string[]): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Grupo no encontrado');
    
    if (!group.students) return group;

    // Convertir a strings para comparar
    const studentIdsStr = studentIds.map(id => id.toString());
    
    group.students = group.students.filter(
      studentId => !studentIdsStr.includes(studentId.toString())
    );
    
    return group.save();
  }

  // Métodos para ExcelService
  /** Buscar grupo por código */
  async findByCode(code: string): Promise<GroupDocument | null> {
    return this.groupModel.findOne({ 
      code: { $regex: `^${code}$`, $options: 'i' } 
    }).populate('subject').populate('career').exec();
  }

  /** Buscar grupos por materia */
  async findBySubject(subjectId: string): Promise<GroupDocument[]> {
    return this.groupModel.find({ 
      subject: new Types.ObjectId(subjectId) 
    }).exec();
  }

  /** Buscar grupos por carrera */
  async findByCareer(careerId: string): Promise<GroupDocument[]> {
    return this.groupModel.find({ 
      career: new Types.ObjectId(careerId) 
    }).exec();
  }
}