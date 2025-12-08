import { Controller, Get, Query, UseGuards, Post, Body, Delete, Param, Res } from '@nestjs/common';
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

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  generate(@Query() dto: GetReportsDto) {
    return this.reportsService.generate(dto);
  }

  @Post('generate')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  generateAndSave(
    @Body() dto: GenerateReportDto,
    @GetUser() user: any,
  ) {
    return this.reportsService.generateAndSaveReport(dto, user._id);
  }

  @Get('history')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  getHistory(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @GetUser() user: any,
  ) {
    return this.reportsService.getReportHistory(user._id, limit, page);
  }

  @Get('export/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  async exportReport(
    @Param('id') id: string,
    @Query('format') format: string = 'json',
    @Res() res: Response,
  ) {
    return this.reportsService.exportReport(id, format, res);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  getSystemStats() {
    return this.reportsService.getSystemStats();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  getReportById(@Param('id') id: string) {
    return this.reportsService.getReportById(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  deleteReport(@Param('id') id: string) {
    return this.reportsService.deleteReport(id);
  }
}