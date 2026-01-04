import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

import { AnalyticsService } from './analytics.service';

@Controller('feedback/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.JEFE, Role.SUBDIRECCION, Role.DESARROLLO_ACADEMICO, Role.SERVICIOS_ESCOLARES)
  @Get('overview')
  overview(@Query('periodId') periodId: string) {
    return this.service.overview(periodId);
  }

  // Dashboard IA: sentimiento + temas + tendencias + top docentes
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.JEFE, Role.SUBDIRECCION, Role.DESARROLLO_ACADEMICO, Role.SERVICIOS_ESCOLARES)
  @Get('ai-dashboard')
  aiDashboard(
    @Query('periodId') periodId: string,
    @Query('topN') topN?: string,
    @Query('bucket') bucket?: 'day' | 'week' | 'month',
  ) {
    return this.service.aiDashboard({
      periodId,
      topN: topN ? Number(topN) : 10,
      bucket: bucket ?? 'month',
    });
  }
}
