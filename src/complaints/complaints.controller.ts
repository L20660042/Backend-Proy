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
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './DTO/create-complaint.dto';
import { UpdateComplaintDto } from './DTO/update-complaint.dto';
import { FilterComplaintsDto } from './DTO/filter-complaints.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  async createComplaint(@Body() createComplaintDto: CreateComplaintDto, @Request() req) {
    try {
      // Obtener la institución del usuario
      const userInstitution = await this.getUserInstitution(req.user.userId);
      
      return await this.complaintsService.createComplaint(
        createComplaintDto, 
        req.user.userId, 
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear queja/evaluación',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  async getComplaints(@Query() filterDto: FilterComplaintsDto, @Request() req) {
    try {
      return await this.complaintsService.getComplaints(
        filterDto, 
        req.user.userId, 
        req.user.userType
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener quejas/evaluaciones',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('stats')
  async getComplaintStats(@Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      return await this.complaintsService.getComplaintStats(userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener estadísticas',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':id')
  async getComplaint(@Param('id') complaintId: string, @Request() req) {
    try {
      return await this.complaintsService.getComplaintById(
        complaintId, 
        req.user.userId, 
        req.user.userType
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener queja/evaluación',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Put(':id')
  async updateComplaint(
    @Param('id') complaintId: string,
    @Body() updateComplaintDto: UpdateComplaintDto,
    @Request() req
  ) {
    try {
      return await this.complaintsService.updateComplaint(
        complaintId,
        updateComplaintDto,
        req.user.userId,
        req.user.userType
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar queja/evaluación',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id')
  async deleteComplaint(@Param('id') complaintId: string, @Request() req) {
    try {
      await this.complaintsService.deleteComplaint(
        complaintId,
        req.user.userId,
        req.user.userType
      );
      return { message: 'Queja/evaluación eliminada correctamente' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al eliminar queja/evaluación',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async getUserInstitution(userId: string): Promise<string> {
    // Esta función debería obtener la institución del usuario
    // Por ahora, asumimos que el usuario tiene un campo institution
    // En una implementación real, necesitarías inyectar el UserModel
    return userId; // Esto es temporal - necesitarás implementar la lógica real
  }
}