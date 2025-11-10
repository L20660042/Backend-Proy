import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Institution } from './institution.schema';
import { User } from '../users/user.schema';

@Injectable()
export class InstitutionService {
  constructor(
    @InjectModel(Institution.name) private institutionModel: Model<Institution>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async createInstitution(data: { 
    name: string; 
    address?: string; 
    phone?: string; 
    createdBy: string;
  }): Promise<Institution> {
    const createdByObjectId = new Types.ObjectId(data.createdBy);
    
    const institution = new this.institutionModel({
      ...data,
      createdBy: createdByObjectId,
      academicStaff: [createdByObjectId],
    });

    return await institution.save();
  }

  async addTeacherToInstitution(
    institutionId: string, 
    teacherEmail: string, 
    addedBy: string
  ): Promise<Institution> {
    const teacher = await this.userModel.findOne({ 
      email: teacherEmail, 
      userType: 'docente' 
    });
    
    if (!teacher) {
      throw new NotFoundException('Docente no encontrado');
    }

    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    // Verificar permisos
    const addedByObjectId = new Types.ObjectId(addedBy);
    const isAcademicStaff = institution.academicStaff.some((staff: Types.ObjectId) => 
      staff.equals(addedByObjectId)
    );

    if (!isAcademicStaff) {
      throw new ForbiddenException('No tienes permisos para agregar docentes');
    }

    // Verificar si el docente ya está en la institución
    const teacherId = teacher._id as Types.ObjectId;
    const isAlreadyTeacher = institution.teachers.some((existingTeacherId: Types.ObjectId) => 
      existingTeacherId.equals(teacherId)
    );

    if (isAlreadyTeacher) {
      throw new ForbiddenException('El docente ya pertenece a esta institución');
    }

    // Agregar docente a la institución
    institution.teachers.push(teacherId);
    
    // Actualizar la institución del docente
    teacher.institution = institution._id as Types.ObjectId;
    await teacher.save();
    
    return await institution.save();
  }

  async requestToJoinInstitution(
    institutionId: string, 
    teacherId: string
  ): Promise<Institution> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    const teacherObjectId = new Types.ObjectId(teacherId);

    // Verificar si ya existe una solicitud pendiente
    const existingRequest = institution.joinRequests.find(
      (req: any) => (req.teacherId as Types.ObjectId).equals(teacherObjectId) && req.status === 'pending'
    );

    if (existingRequest) {
      throw new ForbiddenException('Ya tienes una solicitud pendiente para esta institución');
    }

    // Verificar si ya es docente de la institución
    const isAlreadyTeacher = institution.teachers.some((id: Types.ObjectId) => 
      id.equals(teacherObjectId)
    );

    if (isAlreadyTeacher) {
      throw new ForbiddenException('Ya eres docente de esta institución');
    }

    // Agregar nueva solicitud
    institution.joinRequests.push({
      teacherId: teacherObjectId,
      status: 'pending'
    });

    return await institution.save();
  }

  async handleJoinRequest(
    institutionId: string, 
    teacherId: string, 
    status: 'approved' | 'rejected',
    handledBy: string
  ): Promise<Institution> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    // Verificar permisos
    const handledByObjectId = new Types.ObjectId(handledBy);
    const isAcademicStaff = institution.academicStaff.some((staff: Types.ObjectId) => 
      staff.equals(handledByObjectId)
    );

    if (!isAcademicStaff) {
      throw new ForbiddenException('No tienes permisos para manejar solicitudes');
    }

    const teacherObjectId = new Types.ObjectId(teacherId);
    const request = institution.joinRequests.find(
      (req: any) => (req.teacherId as Types.ObjectId).equals(teacherObjectId) && req.status === 'pending'
    );

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada o ya fue procesada');
    }

    request.status = status;

    if (status === 'approved') {
      const teacher = await this.userModel.findById(teacherId);
      if (!teacher) {
        throw new NotFoundException('Docente no encontrado');
      }

      // Agregar a la lista de docentes
      institution.teachers.push(teacher._id as Types.ObjectId);
      
      // Actualizar la institución del docente
      teacher.institution = institution._id as Types.ObjectId;
      await teacher.save();
    }

    return await institution.save();
  }

  async removeTeacherFromInstitution(
    institutionId: string,
    teacherId: string,
    removedBy: string
  ): Promise<Institution> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    // Verificar permisos
    const removedByObjectId = new Types.ObjectId(removedBy);
    const isAcademicStaff = institution.academicStaff.some((staff: Types.ObjectId) => 
      staff.equals(removedByObjectId)
    );

    if (!isAcademicStaff) {
      throw new ForbiddenException('No tienes permisos para remover docentes');
    }

    const teacherObjectId = new Types.ObjectId(teacherId);

    // Remover de la lista de docentes
    institution.teachers = institution.teachers.filter((id: Types.ObjectId) => 
      !id.equals(teacherObjectId)
    );

    // Actualizar el docente
    await this.userModel.findByIdAndUpdate(teacherId, {
      $unset: { institution: 1 }
    });

    return await institution.save();
  }

  async getInstitutionByUser(userId: string): Promise<Institution | null> {
    const userObjectId = new Types.ObjectId(userId);
    
    return await this.institutionModel.findOne({
      $or: [
        { createdBy: userObjectId },
        { academicStaff: userObjectId },
        { teachers: userObjectId }
      ]
    });
  }

  async getInstitutionDetails(institutionId: string): Promise<any> {
    const institution = await this.institutionModel
      .findById(institutionId)
      .populate('createdBy', 'firstName lastName email')
      .populate('academicStaff', 'firstName lastName email userType')
      .populate('teachers', 'firstName lastName email userType')
      .populate('joinRequests.teacherId', 'firstName lastName email');

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    return institution;
  }
}