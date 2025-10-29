import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule);

    // Configuración CORS ACTUALIZADA
    app.enableCors({
      origin: [
        'http://localhost:5173',
        'https://l20660042.github.io'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept'
      ],
      credentials: true,
    });

    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    const port = process.env.PORT || 3000;
    await app.listen(port);
    
    logger.log(`🚀 Servidor ejecutándose en puerto: ${port}`);
    logger.log(`✅ Entorno: ${process.env.NODE_ENV || 'development'}`);
    
  } catch (error) {
    logger.error('❌ Error al iniciar la aplicación:', error);
    process.exit(1);
  }
}

bootstrap();