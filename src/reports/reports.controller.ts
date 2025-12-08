import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { GetReportsDto } from './dto/get-reports.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('reports')
@UseGuards(JwtGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
  generate(@Query() dto: GetReportsDto) {
    return this.reportsService.generate(dto);
  }
  @Get('export/:id')
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
async exportReport(
  @Param('id') id: string,
  @Query('format') format: string = 'json'
) {
  return this.reportsService.exportReport(id, format);
}

@Get('history')
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JEFE_DEPARTAMENTO)
async getReportHistory() {
  return this.reportsService.getReportHistory();
}
}
