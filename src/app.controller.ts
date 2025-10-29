import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // AGREGAR ESTO para health check
  @Get('health')
  healthCheck() {
    return { 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      message: 'Backend funcionando correctamente'
    };
  }
}