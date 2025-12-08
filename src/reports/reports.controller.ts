import { Controller, Get, Query, UseGuards, Post, Body, Delete, Param, Res, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { GetReportsDto } from './dto/get-reports.dto';
import { GenerateReportDto } from './dto/generate-report.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';
import { GetUser } from '../auth/get-user.decorator';

@Controller('reports')
@UseGuards(JwtGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ========== LISTAR TODOS LOS REPORTES (NUEVO) ==========
  @Get('list')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  async getAllReports(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.reportsService.getAllReports({
      type,
      status,
      search
    }, page, limit);
  }

  // ========== GENERAR REPORTE CON FILTROS ==========
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  generate(@Query() dto: GetReportsDto) {
    return this.reportsService.generate(dto);
  }

  // ========== GENERAR Y GUARDAR REPORTE ==========
  @Post('generate')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  generateAndSave(
    @Body() dto: GenerateReportDto,
    @GetUser() user: any,
  ) {
    return this.reportsService.generateAndSaveReport(dto, user._id);
  }

  // ========== OBTENER HISTORIAL DE REPORTES ==========
  @Get('history')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  getHistory(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @GetUser() user: any,
  ) {
    return this.reportsService.getReportHistory(user._id, limit, page);
  }

  // ========== EXPORTAR REPORTE ==========
  @Get('export/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  async exportReport(
    @Param('id') id: string,
    @Query('format') format: string = 'json',
    @Res() res: Response,
  ) {
    return this.reportsService.exportReport(id, format, res);
  }

  // ========== ESTADÍSTICAS DEL SISTEMA ==========
  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  getSystemStats() {
    return this.reportsService.getSystemStats();
  }

  // ========== OBTENER REPORTE POR ID ==========
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  getReportById(@Param('id') id: string) {
    return this.reportsService.getReportById(id);
  }

  // ========== ELIMINAR REPORTE ==========
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  deleteReport(@Param('id') id: string) {
    return this.reportsService.deleteReport(id);
  }

  // ========== DEBUG: VER TODOS LOS REPORTES EN BD ==========
  @Get('debug/all')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async debugAllReports() {
    return this.reportsService.debugGetAllReports();
  }
}