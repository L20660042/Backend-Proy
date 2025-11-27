import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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
    email?: string;
    website?: string;
    directorName?: string;
    createdBy: string;
  }): Promise<Institution> {
    const createdByObjectId = new Types.ObjectId(data.createdBy);
    
    // Verificar que el usuario creador tenga permisos para crear instituciones
    const creator = await this.userModel.findById(data.createdBy);
    if (!creator) {
      throw new NotFoundException('Usuario creador no encontrado');
    }

    // Solo administradores y jefes académicos pueden crear instituciones
    const allowedUserTypes = ['administrador', 'jefe-departamento', 'subdireccion-academica'];
    if (!allowedUserTypes.includes(creator.userType)) {
      throw new ForbiddenException('No tienes permisos para crear instituciones');
    }

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

    // Verificar permisos - solo staff académico puede agregar docentes
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

  async addStudentToInstitution(
    institutionId: string, 
    studentEmail: string, 
    studentData: {
      studentId?: string;
      enrollmentGroup?: string;
      semester?: number;
    },
    addedBy: string
  ): Promise<Institution> {
    let student = await this.userModel.findOne({ 
      email: studentEmail
    });

    // Si el estudiante no existe, crearlo
    if (!student) {
      student = new this.userModel({
        email: studentEmail,
        userType: 'estudiante',
        firstName: studentData.studentId || 'Estudiante',
        lastName: '',
        password: 'tempPassword123', // Se debe cambiar en el primer login
        ...studentData
      });
      await student.save();
    } else if (student.userType !== 'estudiante') {
      throw new BadRequestException('El usuario no es un estudiante');
    }

    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    // Verificar permisos - solo staff académico puede agregar estudiantes
    const addedByObjectId = new Types.ObjectId(addedBy);
    const isAcademicStaff = institution.academicStaff.some((staff: Types.ObjectId) => 
      staff.equals(addedByObjectId)
    );

    if (!isAcademicStaff) {
      throw new ForbiddenException('No tienes permisos para agregar estudiantes');
    }

    const studentId = student._id as Types.ObjectId;
    const isAlreadyStudent = institution.students.some((existingStudentId: Types.ObjectId) => 
      existingStudentId.equals(studentId)
    );

    if (isAlreadyStudent) {
      throw new ForbiddenException('El estudiante ya pertenece a esta institución');
    }

    // Actualizar datos del estudiante si se proporcionaron
    if (studentData.studentId || studentData.enrollmentGroup || studentData.semester) {
      await this.userModel.findByIdAndUpdate(studentId, {
        $set: studentData
      });
    }

    // Agregar estudiante a la institución
    institution.students.push(studentId);
    student.institution = institution._id as Types.ObjectId;
    await student.save();
    
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

    const teacher = await this.userModel.findById(teacherId);
    if (!teacher || teacher.userType !== 'docente') {
      throw new NotFoundException('Docente no encontrado');
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
      status: 'pending',
      requestedAt: new Date()
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

    // Verificar permisos - solo staff académico puede manejar solicitudes
    const handledByObjectId = new Types.ObjectId(handledBy);
    const isAcademicStaff = institution.academicStaff.some((staff: Types.ObjectId) => 
      staff.equals(handledByObjectId)
    );

    if (!isAcademicStaff) {
      throw new ForbiddenException('No tienes permisos para manejar solicitudes');
    }

    const teacherObjectId = new Types.ObjectId(teacherId);
    const requestIndex = institution.joinRequests.findIndex(
      (req: any) => (req.teacherId as Types.ObjectId).equals(teacherObjectId) && req.status === 'pending'
    );

    if (requestIndex === -1) {
      throw new NotFoundException('Solicitud no encontrada o ya fue procesada');
    }

    // Actualizar el estado de la solicitud
    institution.joinRequests[requestIndex].status = status;

    if (status === 'approved') {
      const teacher = await this.userModel.findById(teacherId);
      if (!teacher) {
        throw new NotFoundException('Docente no encontrado');
      }

      // Verificar que no esté ya en la lista de docentes
      const isAlreadyTeacher = institution.teachers.some((id: Types.ObjectId) => 
        id.equals(teacherObjectId)
      );

      if (!isAlreadyTeacher) {
        // Agregar a la lista de docentes
        institution.teachers.push(teacher._id as Types.ObjectId);
        
        // Actualizar la institución del docente
        teacher.institution = institution._id as Types.ObjectId;
        await teacher.save();
      }
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

    // Remover de staff académico si está allí
    institution.academicStaff = institution.academicStaff.filter((id: Types.ObjectId) => 
      !id.equals(teacherObjectId)
    );

    // Actualizar el docente
    await this.userModel.findByIdAndUpdate(teacherId, {
      $unset: { institution: 1 }
    });

    return await institution.save();
  }

  async removeStudentFromInstitution(
    institutionId: string,
    studentId: string,
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
      throw new ForbiddenException('No tienes permisos para remover estudiantes');
    }

    const studentObjectId = new Types.ObjectId(studentId);

    // Remover de la lista de estudiantes
    institution.students = institution.students.filter((id: Types.ObjectId) => 
      !id.equals(studentObjectId)
    );

    // Actualizar el estudiante
    await this.userModel.findByIdAndUpdate(studentId, {
      $unset: { institution: 1 }
    });

    return await institution.save();
  }

  async addToAcademicStaff(
    institutionId: string,
    userId: string,
    addedBy: string
  ): Promise<Institution> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    // Verificar permisos - solo el creador o administradores pueden agregar staff académico
    const addedByObjectId = new Types.ObjectId(addedBy);
    const isCreator = institution.createdBy.equals(addedByObjectId);
    
    if (!isCreator) {
      const addedByUser = await this.userModel.findById(addedBy);
      if (addedByUser?.userType !== 'administrador') {
        throw new ForbiddenException('No tienes permisos para agregar staff académico');
      }
    }

    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar que el usuario pertenezca a la institución
    const isInInstitution = 
      institution.teachers.some((id: Types.ObjectId) => id.equals(userObjectId)) ||
      institution.academicStaff.some((id: Types.ObjectId) => id.equals(userObjectId));

    if (!isInInstitution) {
      throw new ForbiddenException('El usuario debe pertenecer a la institución primero');
    }

    // Verificar si ya es staff académico
    const isAlreadyAcademicStaff = institution.academicStaff.some((id: Types.ObjectId) => 
      id.equals(userObjectId)
    );

    if (isAlreadyAcademicStaff) {
      throw new ForbiddenException('El usuario ya es staff académico');
    }

    // Agregar a staff académico
    institution.academicStaff.push(userObjectId);
    return await institution.save();
  }

  async getInstitutionByUser(userId: string): Promise<Institution | null> {
    const userObjectId = new Types.ObjectId(userId);
    
    return await this.institutionModel.findOne({
      $or: [
        { createdBy: userObjectId },
        { academicStaff: userObjectId },
        { teachers: userObjectId },
        { students: userObjectId }
      ]
    });
  }

  async getInstitutionDetails(institutionId: string): Promise<any> {
    const institution = await this.institutionModel
      .findById(institutionId)
      .populate('createdBy', 'firstName lastName email userType')
      .populate('academicStaff', 'firstName lastName email userType')
      .populate('teachers', 'firstName lastName email userType specialty')
      .populate('students', 'firstName lastName email studentId enrollmentGroup semester')
      .populate('joinRequests.teacherId', 'firstName lastName email userType specialty');

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    return institution;
  }

  async getInstitutionMembers(institutionId: string): Promise<any> {
    const institution = await this.institutionModel
      .findById(institutionId)
      .populate('academicStaff', 'firstName lastName email userType')
      .populate('teachers', 'firstName lastName email userType specialty')
      .populate('students', 'firstName lastName email studentId enrollmentGroup semester');

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    return {
      academicStaff: institution.academicStaff,
      teachers: institution.teachers,
      students: institution.students
    };
  }

  async getPendingJoinRequests(institutionId: string, userId: string): Promise<any[]> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    // Verificar permisos
    const userObjectId = new Types.ObjectId(userId);
    const isAcademicStaff = institution.academicStaff.some((staff: Types.ObjectId) => 
      staff.equals(userObjectId)
    );

    if (!isAcademicStaff) {
      throw new ForbiddenException('No tienes permisos para ver las solicitudes');
    }

    const pendingRequests = institution.joinRequests.filter(
      (req: any) => req.status === 'pending'
    );

    // Populate teacher info for pending requests
    const populatedRequests = await this.institutionModel
      .findById(institutionId)
      .populate({
        path: 'joinRequests.teacherId',
        select: 'firstName lastName email userType specialty'
      });

    if (!populatedRequests) {
      throw new NotFoundException('Institución no encontrada');
    }

    return populatedRequests.joinRequests.filter((req: any) => req.status === 'pending');
  }
}