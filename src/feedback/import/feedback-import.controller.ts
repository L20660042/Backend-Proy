import { BadRequestException, Controller, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

import { FeedbackImportService } from './feedback-import.service';

@Controller('feedback/import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.SERVICIOS_ESCOLARES)
export class FeedbackImportController {
  constructor(private readonly service: FeedbackImportService) {}

  private ensureFile(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo CSV requerido en field "file"');
  }

  @Post('evaluations')
  @UseInterceptors(FileInterceptor('file'))
  importEvaluations(@UploadedFile() file?: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    this.ensureFile(file);
    return this.service.importEvaluations(file!, dryRun === '1' || dryRun === 'true');
  }

  @Post('complaints')
  @UseInterceptors(FileInterceptor('file'))
  importComplaints(@UploadedFile() file?: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    this.ensureFile(file);
    return this.service.importComplaints(file!, dryRun === '1' || dryRun === 'true');
  }

  // Opcional: reprocesar IA en registros pendientes
  @Post('process-pending')
  processPending(@Query('limit') limit?: string) {
    const lim = Number(limit ?? 50);
    return this.service.processPendingAi(Number.isFinite(lim) ? lim : 50);
  }
}
