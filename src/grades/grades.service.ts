import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Grade } from './grade.schema';
import { CreateGradeDto } from './DTO/create-grade.dto';
import { UpdateGradeDto } from './DTO/update-grade.dto';
import { FilterGradesDto } from './DTO/filter-grades.dto';
import { BulkGradesDto } from './DTO/bulk-grades.dto';
import { User } from '../users/user.schema';
import { Subject } from '../subjects/subject.schema';
import { Group } from '../groups/group.schema';

@Injectable()
export class GradesService {
  constructor(
    @InjectModel(Grade.name) private gradeModel: Model<Grade>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
  ) {}

  async createGrade(createGradeDto: CreateGradeDto, teacherId: string, institutionId: string): Promise<Grade> {
    // Verificar que el docente existe y tiene permisos
    const teacher = await this.userModel.findOne({
      _id: teacherId,
      institution: institutionId,
      userType: { $in: ['docente', 'jefe-departamento'] }
    });

    if (!teacher) {
      throw new ForbiddenException('Docente no encontrado o sin permisos');
    }

    // Verificar que el estudiante existe y pertenece a la institución
    const student = await this.userModel.findOne({
      _id: createGradeDto.student,
      institution: institutionId,
      userType: 'estudiante'
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    // Verificar que la materia existe y está asignada al docente
    const subject = await this.subjectModel.findOne({
      _id: createGradeDto.subject,
      institution: institutionId,
      $or: [
        { assignedTeacher: teacherId },
        { institution: institutionId } // Jefes de departamento pueden calificar cualquier materia
      ]
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada o no asignada');
    }

    // Verificar que el grupo existe y pertenece a la institución
    const group = await this.groupModel.findOne({
      _id: createGradeDto.group,
      institution: institutionId
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Verificar que el estudiante pertenece al grupo
    const isStudentInGroup = group.students.some(studentId => 
      studentId.equals(new Types.ObjectId(createGradeDto.student))
    );

    if (!isStudentInGroup) {
      throw new ForbiddenException('El estudiante no pertenece a este grupo');
    }

    // Verificar si ya existe una calificación para este estudiante, materia, grupo y período
    const existingGrade = await this.gradeModel.findOne({
      student: createGradeDto.student,
      subject: createGradeDto.subject,
      group: createGradeDto.group,
      period: createGradeDto.period,
      isActive: true
    });

    if (existingGrade) {
      throw new BadRequestException('Ya existe una calificación para este estudiante en el período seleccionado');
    }

    const grade = new this.gradeModel({
      ...createGradeDto,
      teacher: new Types.ObjectId(teacherId),
      institution: new Types.ObjectId(institutionId),
      lastModifiedBy: new Types.ObjectId(teacherId),
      lastModifiedAt: new Date()
    });

    return await grade.save();
  }

  async createBulkGrades(bulkGradesDto: BulkGradesDto, teacherId: string, institutionId: string): Promise<any> {
    // Verificar permisos del docente
    const teacher = await this.userModel.findOne({
      _id: teacherId,
      institution: institutionId,
      userType: { $in: ['docente', 'jefe-departamento'] }
    });

    if (!teacher) {
      throw new ForbiddenException('Docente no encontrado o sin permisos');
    }

    // Verificar que la materia existe y está asignada al docente
    const subject = await this.subjectModel.findOne({
      _id: bulkGradesDto.subject,
      institution: institutionId,
      $or: [
        { assignedTeacher: teacherId },
        { institution: institutionId }
      ]
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada o no asignada');
    }

    // Verificar que el grupo existe
    const group = await this.groupModel.findOne({
      _id: bulkGradesDto.group,
      institution: institutionId
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    const results = {
      success: 0,
      errors: [] as string[],
      grades: [] as Grade[]
    };

    for (const gradeData of bulkGradesDto.grades) {
      try {
        // Verificar que el estudiante existe y pertenece al grupo
        const student = await this.userModel.findOne({
          _id: gradeData.student,
          institution: institutionId,
          userType: 'estudiante'
        });

        if (!student) {
          results.errors.push(`Estudiante ${gradeData.student} no encontrado`);
          continue;
        }

        const isStudentInGroup = group.students.some(studentId => 
          studentId.equals(new Types.ObjectId(gradeData.student))
        );

        if (!isStudentInGroup) {
          results.errors.push(`Estudiante ${student.firstName} ${student.lastName} no pertenece al grupo`);
          continue;
        }

        // Verificar si ya existe una calificación
        const existingGrade = await this.gradeModel.findOne({
          student: gradeData.student,
          subject: bulkGradesDto.subject,
          group: bulkGradesDto.group,
          period: bulkGradesDto.period,
          isActive: true
        });

        if (existingGrade) {
          // Actualizar calificación existente
          existingGrade.score = gradeData.score;
          existingGrade.lastModifiedBy = new Types.ObjectId(teacherId);
          existingGrade.lastModifiedAt = new Date();
          await existingGrade.save();
          results.grades.push(existingGrade);
        } else {
          // Crear nueva calificación
          const grade = new this.gradeModel({
            student: gradeData.student,
            subject: bulkGradesDto.subject,
            group: bulkGradesDto.group,
            teacher: teacherId,
            score: gradeData.score,
            period: bulkGradesDto.period,
            institution: institutionId,
            lastModifiedBy: new Types.ObjectId(teacherId),
            lastModifiedAt: new Date()
          });
          await grade.save();
          results.grades.push(grade);
        }

        results.success++;
      } catch (error) {
        results.errors.push(`Error con estudiante ${gradeData.student}: ${error.message}`);
      }
    }

    return results;
  }

  async getGrades(filterDto: FilterGradesDto, userId: string, userType: string): Promise<Grade[]> {
    const filter: any = { isActive: true };

    // Aplicar filtros
    if (filterDto.student) filter.student = new Types.ObjectId(filterDto.student);
    if (filterDto.subject) filter.subject = new Types.ObjectId(filterDto.subject);
    if (filterDto.group) filter.group = new Types.ObjectId(filterDto.group);
    if (filterDto.teacher) filter.teacher = new Types.ObjectId(filterDto.teacher);
    if (filterDto.period) filter.period = filterDto.period;
    if (filterDto.institution) filter.institution = new Types.ObjectId(filterDto.institution);

    // Filtros basados en el tipo de usuario
    if (userType === 'estudiante') {
      filter.student = new Types.ObjectId(userId);
    } else if (userType === 'docente' || userType === 'tutor') {
      filter.teacher = new Types.ObjectId(userId);
    }
    // Staff académico puede ver todas las calificaciones

    return await this.gradeModel
      .find(filter)
      .populate('student', 'firstName lastName email studentId')
      .populate('subject', 'name code credits')
      .populate('group', 'name code grade')
      .populate('teacher', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName')
      .sort({ period: 1, 'student.lastName': 1 })
      .exec();
  }

  async getGradeById(gradeId: string, userId: string, userType: string): Promise<Grade> {
    const grade = await this.gradeModel
      .findById(gradeId)
      .populate('student', 'firstName lastName email studentId')
      .populate('subject', 'name code credits')
      .populate('group', 'name code grade')
      .populate('teacher', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName')
      .exec();

    if (!grade) {
      throw new NotFoundException('Calificación no encontrada');
    }

    // Verificar permisos de acceso
    this.checkGradeAccess(grade, userId, userType);

    return grade;
  }

  async updateGrade(
    gradeId: string, 
    updateGradeDto: UpdateGradeDto, 
    userId: string, 
    userType: string
  ): Promise<Grade> {
    const grade = await this.gradeModel.findById(gradeId);
    
    if (!grade) {
      throw new NotFoundException('Calificación no encontrada');
    }

    // Verificar permisos
    this.checkGradeModificationAccess(grade, userId, userType);

    const updateData: any = {
      ...updateGradeDto,
      lastModifiedBy: new Types.ObjectId(userId),
      lastModifiedAt: new Date()
    };

    const updatedGrade = await this.gradeModel
      .findByIdAndUpdate(gradeId, updateData, { new: true })
      .populate('student', 'firstName lastName email studentId')
      .populate('subject', 'name code credits')
      .populate('group', 'name code grade')
      .populate('teacher', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName')
      .exec();

    if (!updatedGrade) {
      throw new NotFoundException('Calificación no encontrada después de actualizar');
    }

    return updatedGrade;
  }

  async deleteGrade(gradeId: string, userId: string, userType: string): Promise<{ message: string }> {
    const grade = await this.gradeModel.findById(gradeId);
    
    if (!grade) {
      throw new NotFoundException('Calificación no encontrada');
    }

    // Verificar permisos
    this.checkGradeModificationAccess(grade, userId, userType);

    // En lugar de eliminar, marcamos como inactiva
    grade.isActive = false;
    grade.lastModifiedBy = new Types.ObjectId(userId);
    grade.lastModifiedAt = new Date();
    await grade.save();

    return { message: 'Calificación eliminada correctamente' };
  }

  async getStudentGradesReport(studentId: string, institutionId: string): Promise<any> {
    const grades = await this.gradeModel
      .find({
        student: new Types.ObjectId(studentId),
        institution: new Types.ObjectId(institutionId),
        isActive: true
      })
      .populate('subject', 'name code credits')
      .populate('group', 'name code grade')
      .populate('teacher', 'firstName lastName')
      .sort({ 'subject.name': 1, period: 1 })
      .exec();

    // Calcular promedios por período
    const periodAverages: any = {};
    const subjectGrades: any = {};

    grades.forEach(grade => {
      // Agrupar por período
      if (!periodAverages[grade.period]) {
        periodAverages[grade.period] = { total: 0, count: 0, average: 0 };
      }
      periodAverages[grade.period].total += grade.score;
      periodAverages[grade.period].count += 1;

      // Agrupar por materia
      const subjectId = (grade.subject as any)._id.toString();
      if (!subjectGrades[subjectId]) {
        subjectGrades[subjectId] = {
          subject: grade.subject,
          grades: [],
          average: 0
        };
      }
      subjectGrades[subjectId].grades.push(grade);
    });

    // Calcular promedios
    Object.keys(periodAverages).forEach(period => {
      periodAverages[period].average = 
        periodAverages[period].total / periodAverages[period].count;
    });

    Object.keys(subjectGrades).forEach(subjectId => {
      const total = subjectGrades[subjectId].grades.reduce((sum: number, grade: Grade) => sum + grade.score, 0);
      subjectGrades[subjectId].average = total / subjectGrades[subjectId].grades.length;
    });

    return {
      grades,
      periodAverages,
      subjectGrades: Object.values(subjectGrades),
      overallAverage: grades.length > 0 ? 
        grades.reduce((sum, grade) => sum + grade.score, 0) / grades.length : 0
    };
  }

  async getGroupGradesReport(groupId: string, subjectId: string, period: string): Promise<any> {
    const grades = await this.gradeModel
      .find({
        group: new Types.ObjectId(groupId),
        subject: new Types.ObjectId(subjectId),
        period: period,
        isActive: true
      })
      .populate('student', 'firstName lastName email studentId')
      .populate('subject', 'name code credits')
      .populate('group', 'name code grade')
      .populate('teacher', 'firstName lastName')
      .sort({ 'student.lastName': 1 })
      .exec();

    const stats = {
      totalStudents: grades.length,
      average: 0,
      highest: 0,
      lowest: 100,
      passed: 0,
      failed: 0
    };

    if (grades.length > 0) {
      const scores = grades.map(grade => grade.score);
      stats.average = scores.reduce((a, b) => a + b, 0) / scores.length;
      stats.highest = Math.max(...scores);
      stats.lowest = Math.min(...scores);
      stats.passed = scores.filter(score => score >= 60).length;
      stats.failed = scores.filter(score => score < 60).length;
    }

    return {
      grades,
      statistics: stats
    };
  }

  private checkGradeAccess(grade: Grade, userId: string, userType: string): void {
    const userObjectId = new Types.ObjectId(userId);

    if (userType === 'estudiante') {
      if (!grade.student.equals(userObjectId)) {
        throw new ForbiddenException('No tienes acceso a esta calificación');
      }
    } else if (userType === 'docente' || userType === 'tutor') {
      if (!grade.teacher.equals(userObjectId)) {
        throw new ForbiddenException('No tienes acceso a esta calificación');
      }
    }
  }

  private checkGradeModificationAccess(grade: Grade, userId: string, userType: string): void {
    const userObjectId = new Types.ObjectId(userId);

    if (userType === 'docente' || userType === 'tutor') {
      if (!grade.teacher.equals(userObjectId)) {
        throw new ForbiddenException('No tienes permisos para modificar esta calificación');
      }
    } else if (!['jefe-departamento', 'control-escolar', 'subdireccion-academica', 'administrador'].includes(userType)) {
      throw new ForbiddenException('No tienes permisos para modificar calificaciones');
    }
  }
}