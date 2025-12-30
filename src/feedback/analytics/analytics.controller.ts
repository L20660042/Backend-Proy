import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

import { AnalyticsService } from './analytics.service';

@Controller('feedback/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.JEFE, Role.SUBDIRECCION, Role.DESARROLLO_ACADEMICO)
  @Get('overview')
  overview(@Query('periodId') periodId: string) {
    return this.service.overview(periodId);
  }
}
