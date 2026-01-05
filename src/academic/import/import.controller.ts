import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';
import { ImportService } from './import.service';

function ensureFile(file?: Express.Multer.File) {
  if (!file) throw new BadRequestException('Archivo requerido');
}

@Controller('academic/import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
export class ImportController {
  constructor(private readonly service: ImportService) {}

  @Post('periods')
  @UseInterceptors(FileInterceptor('file'))
  async importPeriods(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importPeriods(file, dryRun === 'true');
  }

  @Post('careers')
  @UseInterceptors(FileInterceptor('file'))
  async importCareers(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importCareers(file, dryRun === 'true');
  }

  @Post('subjects')
  @UseInterceptors(FileInterceptor('file'))
  async importSubjects(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importSubjects(file, dryRun === 'true');
  }

  @Post('teachers')
  @UseInterceptors(FileInterceptor('file'))
  async importTeachers(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importTeachers(file, dryRun === 'true');
  }

  @Post('groups')
  @UseInterceptors(FileInterceptor('file'))
  async importGroups(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importGroups(file, dryRun === 'true');
  }

  @Post('activities')
  @UseInterceptors(FileInterceptor('file'))
  async importActivities(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importActivities(file, dryRun === 'true');
  }

  @Post('students')
  @UseInterceptors(FileInterceptor('file'))
  async importStudents(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importStudents(file, dryRun === 'true');
  }

  @Post('class-assignments')
  @UseInterceptors(FileInterceptor('file'))
  async importClassAssignments(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importClassAssignments(file, dryRun === 'true');
  }

  @Post('enrollments')
  @UseInterceptors(FileInterceptor('file'))
  async importEnrollments(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importEnrollments(file, dryRun === 'true');
  }
  @Post('activity-enrollments')
  @UseInterceptors(FileInterceptor('file'))
  async importActivityEnrollments(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
  ) {
    ensureFile(file);
    return this.service.importActivityEnrollments(file, dryRun === 'true');
  }

  @Post('schedule-blocks')
  @UseInterceptors(FileInterceptor('file'))
  async importScheduleBlocks(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    ensureFile(file);
    return this.service.importScheduleBlocks(file, dryRun === 'true');
  }
    @Post('grades')
  @UseInterceptors(FileInterceptor('file'))
  async importGrades(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
  ) {
    ensureFile(file);
    return this.service.importGrades(file, dryRun === 'true');
  }
}
