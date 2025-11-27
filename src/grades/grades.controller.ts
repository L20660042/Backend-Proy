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
  HttpStatus
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './DTO/create-grade.dto';
import { UpdateGradeDto } from './DTO/update-grade.dto';
import { FilterGradesDto } from './DTO/filter-grades.dto';
import { BulkGradesDto } from './DTO/bulk-grades.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('grades')
@UseGuards(JwtAuthGuard)
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post()
  async createGrade(@Body() createGradeDto: CreateGradeDto, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.gradesService.createGrade(
        createGradeDto, 
        req.user.userId, 
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear calificación',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('bulk')
  async createBulkGrades(@Body() bulkGradesDto: BulkGradesDto, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.gradesService.createBulkGrades(
        bulkGradesDto, 
        req.user.userId, 
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear calificaciones en lote',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  async getGrades(@Query() filterDto: FilterGradesDto, @Request() req) {
    try {
      return await this.gradesService.getGrades(
        filterDto, 
        req.user.userId, 
        req.user.userType
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener calificaciones',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('student-report/:studentId')
  async getStudentGradesReport(@Param('studentId') studentId: string, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.gradesService.getStudentGradesReport(studentId, userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener reporte del estudiante',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('group-report/:groupId/:subjectId/:period')
  async getGroupGradesReport(
    @Param('groupId') groupId: string,
    @Param('subjectId') subjectId: string,
    @Param('period') period: string,
    @Request() req
  ) {
    try {
      return await this.gradesService.getGroupGradesReport(groupId, subjectId, period);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener reporte del grupo',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('my-grades')
  async getMyGrades(@Request() req) {
    try {
      const filterDto: FilterGradesDto = { student: req.user.userId };
      return await this.gradesService.getGrades(
        filterDto, 
        req.user.userId, 
        req.user.userType
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener mis calificaciones',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':id')
  async getGrade(@Param('id') gradeId: string, @Request() req) {
    try {
      return await this.gradesService.getGradeById(
        gradeId, 
        req.user.userId, 
        req.user.userType
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener calificación',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Put(':id')
  async updateGrade(
    @Param('id') gradeId: string,
    @Body() updateGradeDto: UpdateGradeDto,
    @Request() req
  ) {
    try {
      return await this.gradesService.updateGrade(
        gradeId,
        updateGradeDto,
        req.user.userId,
        req.user.userType
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar calificación',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id')
  async deleteGrade(@Param('id') gradeId: string, @Request() req) {
    try {
      const result = await this.gradesService.deleteGrade(
        gradeId,
        req.user.userId,
        req.user.userType
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al eliminar calificación',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async getUserInstitution(userId: string): Promise<string | null> {
    // Esta función debería obtener la institución del usuario
    // Implementación temporal - necesitarás conectar con InstitutionService
    try {
      // Por ahora, retornamos un valor temporal
      // En producción, necesitas implementar esta lógica
      return userId;
    } catch (error) {
      return null;
    }
  }
}