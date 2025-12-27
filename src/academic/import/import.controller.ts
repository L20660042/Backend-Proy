import {
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

import { ImportService } from './import.service';

@Controller('academic/import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('students')
  @UseInterceptors(FileInterceptor('file'))
  importStudents(
    @UploadedFile() file?: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo CSV requerido en field "file"');
    return this.importService.importStudents(file, dryRun === '1' || dryRun === 'true');
  }

  @Post('class-assignments')
  @UseInterceptors(FileInterceptor('file'))
  importClassAssignments(
    @UploadedFile() file?: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo CSV requerido en field "file"');
    return this.importService.importClassAssignments(file, dryRun === '1' || dryRun === 'true');
  }

  @Post('schedule-blocks')
  @UseInterceptors(FileInterceptor('file'))
  importScheduleBlocks(
    @UploadedFile() file?: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo CSV requerido en field "file"');
    return this.importService.importScheduleBlocks(file, dryRun === '1' || dryRun === 'true');
  }
}
