import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

import { EvaluationsService } from './evaluations.service';
import { CreateTeacherEvaluationDto } from './dto/create-evaluation.dto';
import { EVALUATION_ITEMS } from './evaluation-template';

@Controller('feedback/evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private readonly service: EvaluationsService) {}

  @Roles(Role.ALUMNO)
  @Get('form')
  form() {
    return { items: EVALUATION_ITEMS };
  }

  @Roles(Role.ALUMNO)
  @Get('me')
  me(@Req() req: any, @Query('periodId') periodId: string) {
    return this.service.listMyEvaluations(req.user, periodId);
  }

  @Roles(Role.ALUMNO)
  @Post()
  create(@Req() req: any, @Body() dto: CreateTeacherEvaluationDto) {
    return this.service.createAsStudent(req.user, dto);
  }

  // Resumen para docente
  @Roles(Role.DOCENTE)
  @Get('/teachers/me/summary')
  teacherSummary(@Req() req: any, @Query('periodId') periodId: string) {
    return this.service.teacherSummary(req.user, periodId);
  }
}
