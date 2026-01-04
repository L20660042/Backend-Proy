import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';
import { GradesAnalyticsService } from './grades-analytics.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  Role.SUPERADMIN,
  Role.ADMIN,
  Role.SERVICIOS_ESCOLARES,
  Role.JEFE,
  Role.SUBDIRECCION,
  Role.DESARROLLO_ACADEMICO,
  Role.DOCENTE,
)
@Controller('academic/analytics/grades')
export class GradesAnalyticsController {
  constructor(private readonly service: GradesAnalyticsService) {}

  // GET /academic/analytics/grades/overview?periodId=...&careerId=...&failRateMin=0.4&minCount=10
  @Get('overview')
  overview(
    @Query('periodId') periodId: string,
    @Query('careerId') careerId?: string,
    @Query('groupId') groupId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('passThreshold') passThreshold?: string,
    @Query('failRateMin') failRateMin?: string,
    @Query('minCount') minCount?: string,
    @Query('topN') topN?: string,
  ) {
    return this.service.overview({
      periodId,
      careerId,
      groupId,
      teacherId,
      subjectId,
      passThreshold: passThreshold ? Number(passThreshold) : undefined,
      failRateMin: failRateMin ? Number(failRateMin) : undefined,
      minCount: minCount ? Number(minCount) : undefined,
      topN: topN ? Number(topN) : undefined,
    });
  }
}
