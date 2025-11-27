import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  HttpException,
  HttpStatus,
  ForbiddenException
} from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './DTO/create-subject.dto';
import { UpdateSubjectDto } from './DTO/update-subject.dto';
import { AssignTeacherDto, AssignTeachersDto } from './DTO/assign-teacher.dto';
import { FilterSubjectsDto } from './DTO/filter-subjects.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subjects')
@UseGuards(JwtAuthGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  async createSubject(@Body() createSubjectDto: CreateSubjectDto, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.subjectsService.createSubject(
        createSubjectDto, 
        req.user.userId, 
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear materia',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  async getSubjects(@Query() filterDto: FilterSubjectsDto, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.subjectsService.getSubjects(filterDto, userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener materias',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('stats')
  async getSubjectStats(@Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.subjectsService.getSubjectStats(userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener estadísticas de materias',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('my-subjects')
  async getMySubjects(@Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }

      // Solo docentes pueden ver sus materias asignadas
      if (!['docente', 'tutor'].includes(req.user.userType)) {
        throw new ForbiddenException('Solo docentes pueden ver sus materias asignadas');
      }
      
      return await this.subjectsService.getMySubjects(req.user.userId, userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener mis materias',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':id')
  async getSubject(@Param('id') subjectId: string, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.subjectsService.getSubjectById(subjectId, userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener materia',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Put(':id')
  async updateSubject(
    @Param('id') subjectId: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
    @Request() req
  ) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.subjectsService.updateSubject(
        subjectId,
        updateSubjectDto,
        req.user.userId,
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar materia',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id')
  async deleteSubject(@Param('id') subjectId: string, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      const result = await this.subjectsService.deleteSubject(
        subjectId,
        req.user.userId,
        userInstitution
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al eliminar materia',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/assign-teacher')
  async assignTeacherToSubject(
    @Param('id') subjectId: string,
    @Body() assignTeacherDto: AssignTeacherDto,
    @Request() req
  ) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.subjectsService.assignTeacherToSubject(
        subjectId,
        assignTeacherDto,
        req.user.userId,
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al asignar docente a la materia',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/available-teachers')
  async addAvailableTeachers(
    @Param('id') subjectId: string,
    @Body() assignTeachersDto: AssignTeachersDto,
    @Request() req
  ) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.subjectsService.addAvailableTeachers(
        subjectId,
        assignTeachersDto,
        req.user.userId,
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al agregar docentes disponibles',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id/teachers/:teacherId')
  async removeTeacherFromSubject(
    @Param('id') subjectId: string,
    @Param('teacherId') teacherId: string,
    @Request() req
  ) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.subjectsService.removeTeacherFromSubject(
        subjectId,
        teacherId,
        req.user.userId,
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al remover docente de la materia',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async getUserInstitution(userId: string): Promise<string | null> {
    // Implementación temporal - conectar con InstitutionService
    try {
      return userId;
    } catch (error) {
      return null;
    }
  }
}