import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false }); // Desactiva el automático

  app.enableCors({
    origin: [
      'https://l20660042.github.io/Frontendproyecto',
      'https://l20660042.github.io',
      'http://localhost:5173'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  await app.listen(process.env.PORT || 3000);
  console.log('✅ Servidor NestJS activo');
}
bootstrap();
