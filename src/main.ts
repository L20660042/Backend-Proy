import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { ErrorsInterceptor } from './interceptors/errors.interceptor';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración de CORS actualizada
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://l20660042.github.io',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
    new ErrorsInterceptor(),
  );

  await app.listen(3000);
  console.log(`Server running on http://localhost:3000`);
}

bootstrap();
