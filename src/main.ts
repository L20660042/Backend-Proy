import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { ErrorsInterceptor } from './interceptors/errors.interceptor';
import { ValidationPipe } from '@nestjs/common';
// REMOVER: import { CorsInterceptor } from './interceptors/cors.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración CORS CORREGIDA
  const allowedOrigins = [
    'http://localhost:5173',
    'https://l20660042.github.io',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite solicitudes sin origen (como aplicaciones móviles o curl)
      if (!origin) return callback(null, true);
      
      // Verifica si el origen está en la lista permitida
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn(`Origen CORS bloqueado: ${origin}`);
        return callback(new Error('Origen no permitido por CORS'), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    maxAge: 86400, // 24 horas para cache de preflight
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    // REMOVER: new CorsInterceptor(),  // <--- ESTA LÍNEA CAUSA EL PROBLEMA
    new TransformInterceptor(),
    new ErrorsInterceptor(),
  );

  await app.listen(3000);
  console.log(`Server running on http://localhost:3000`);
}

bootstrap();
