import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { ErrorsInterceptor } from './interceptors/errors.interceptor';
import { ValidationPipe } from '@nestjs/common';
import { CorsInterceptor } from './interceptors/cors.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración CORS más robusta
  const allowedOrigins = [
    'http://localhost:5173',
    'https://l20660042.github.io',
  ];

  app.enableCors({
    origin: function (origin, callback) {
      // Permite solicitudes sin origen (como aplicaciones móviles o curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `El origen CORS ${origin} no está permitido`;
        console.warn(msg);
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
    credentials: true,
    maxAge: 86400, // 24 horas
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  // Middleware adicional para manejar CORS manualmente
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    
    // Manejar solicitudes preflight OPTIONS
    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }
    
    next();
  });
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  app.useGlobalInterceptors(
    new CorsInterceptor(),
    new LoggingInterceptor(),
    new TransformInterceptor(),
    new ErrorsInterceptor(),
  );

  await app.listen(3000);
  console.log(`Server running on http://localhost:3000`);
}

bootstrap();
