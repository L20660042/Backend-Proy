import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards,
  Request,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('institutions')
@UseGuards(JwtAuthGuard)
export class InstitutionController {
  constructor(
    private readonly institutionService: InstitutionService
  ) {}

  @Post()
  async createInstitution(@Body() data: any, @Request() req) {
    try {
      return await this.institutionService.createInstitution({
        ...data,
        createdBy: req.user.userId
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear institución',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/teachers')
  async addTeacher(
    @Param('id') institutionId: string,
    @Body() body: { teacherEmail: string },
    @Request() req
  ) {
    try {
      return await this.institutionService.addTeacherToInstitution(
        institutionId,
        body.teacherEmail,
        req.user.userId
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al agregar docente',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/join-request')
  async requestToJoin(@Param('id') institutionId: string, @Request() req) {
    try {
      return await this.institutionService.requestToJoinInstitution(
        institutionId,
        req.user.userId
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al enviar solicitud',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Put(':id/join-request/:teacherId')
  async handleJoinRequest(
    @Param('id') institutionId: string,
    @Param('teacherId') teacherId: string,
    @Body() body: { status: 'approved' | 'rejected' },
    @Request() req
  ) {
    try {
      return await this.institutionService.handleJoinRequest(
        institutionId,
        teacherId,
        body.status,
        req.user.userId
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al procesar solicitud',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id/teachers/:teacherId')
  async removeTeacher(
    @Param('id') institutionId: string,
    @Param('teacherId') teacherId: string,
    @Request() req
  ) {
    try {
      return await this.institutionService.removeTeacherFromInstitution(
        institutionId,
        teacherId,
        req.user.userId
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al remover docente',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('my-institution')
  async getMyInstitution(@Request() req) {
    try {
      const institution = await this.institutionService.getInstitutionByUser(req.user.userId);
      if (!institution) {
        throw new HttpException('No perteneces a ninguna institución', HttpStatus.NOT_FOUND);
      }
      return institution;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener institución',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':id')
  async getInstitution(@Param('id') institutionId: string) {
    try {
      return await this.institutionService.getInstitutionDetails(institutionId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener institución',
        HttpStatus.BAD_REQUEST
      );
    }
  }
}