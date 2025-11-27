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
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './DTO/create-group.dto';
import { UpdateGroupDto } from './DTO/update-group.dto';
import { AssignStudentsDto, AssignStudentDto } from './DTO/assign-student.dto';
import { AssignSubjectDto } from './DTO/assign-subject.dto';
import { FilterGroupsDto } from './DTO/filter-groups.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  async createGroup(@Body() createGroupDto: CreateGroupDto, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.groupsService.createGroup(
        createGroupDto, 
        req.user.userId, 
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear grupo',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  async getGroups(@Query() filterDto: FilterGroupsDto, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.groupsService.getGroups(filterDto, userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener grupos',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('stats')
  async getGroupStats(@Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.groupsService.getGroupStats(userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener estadísticas de grupos',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('my-groups')
  async getMyGroups(@Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }

      let filterDto: FilterGroupsDto = {};

      // Filtrar según el tipo de usuario
      if (req.user.userType === 'estudiante') {
        filterDto.student = req.user.userId;
      } else if (req.user.userType === 'docente' || req.user.userType === 'tutor') {
        filterDto.teacher = req.user.userId;
      }
      
      return await this.groupsService.getGroups(filterDto, userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener mis grupos',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':id')
  async getGroup(@Param('id') groupId: string, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.groupsService.getGroupById(groupId, userInstitution);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener grupo',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Put(':id')
  async updateGroup(
    @Param('id') groupId: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @Request() req
  ) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.groupsService.updateGroup(
        groupId,
        updateGroupDto,
        req.user.userId,
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar grupo',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id')
  async deleteGroup(@Param('id') groupId: string, @Request() req) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      const result = await this.groupsService.deleteGroup(
        groupId,
        req.user.userId,
        userInstitution
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al eliminar grupo',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/students')
  async assignStudentToGroup(
    @Param('id') groupId: string,
    @Body() assignStudentDto: AssignStudentDto,
    @Request() req
  ) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.groupsService.assignStudentToGroup(
        groupId,
        assignStudentDto,
        req.user.userId,
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al asignar estudiante al grupo',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/students/bulk')
  async assignStudentsToGroup(
    @Param('id') groupId: string,
    @Body() assignStudentsDto: AssignStudentsDto,
    @Request() req
  ) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.groupsService.assignStudentsToGroup(
        groupId,
        assignStudentsDto,
        req.user.userId,
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al asignar estudiantes al grupo',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id/students/:studentId')
  async removeStudentFromGroup(
    @Param('id') groupId: string,
    @Param('studentId') studentId: string,
    @Request() req
  ) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.groupsService.removeStudentFromGroup(
        groupId,
        studentId,
        req.user.userId,
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al remover estudiante del grupo',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/subjects')
  async assignSubjectToGroup(
    @Param('id') groupId: string,
    @Body() assignSubjectDto: AssignSubjectDto,
    @Request() req
  ) {
    try {
      const userInstitution = await this.getUserInstitution(req.user.userId);
      if (!userInstitution) {
        throw new HttpException('Usuario no pertenece a ninguna institución', HttpStatus.BAD_REQUEST);
      }
      
      return await this.groupsService.assignSubjectToGroup(
        groupId,
        assignSubjectDto,
        req.user.userId,
        userInstitution
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al asignar materia al grupo',
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