import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return "Sistema de Gestión Académica - API"', () => {
      expect(appController.getHello()).toBe('Sistema de Gestión Académica - API');
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = { status: 'OK', timestamp: expect.any(String) };
      jest.spyOn(appService, 'getHealth').mockImplementation(() => result);
      
      expect(appController.getHealth()).toEqual(result);
    });
  });

  describe('system-info', () => {
    it('should return system information', () => {
      const result = {
        name: 'Sistema de Gestión Académica',
        version: '1.0.0',
        description: 'Sistema integral para gestión de instituciones educativas',
        modules: expect.any(Array),
        environment: expect.any(String),
        timestamp: expect.any(String),
      };
      jest.spyOn(appService, 'getSystemInfo').mockImplementation(() => result);
      
      expect(appController.getSystemInfo()).toEqual(result);
    });
  });
});