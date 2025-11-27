import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }

  @Get('protected')
  @UseGuards(JwtAuthGuard)
  getProtected(): { message: string } {
    return { message: 'Esta es una ruta protegida' };
  }

  @Get('system-info')
  getSystemInfo(): any {
    return this.appService.getSystemInfo();
  }
}