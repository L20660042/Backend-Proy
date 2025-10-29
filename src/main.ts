import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permitir solicitudes desde el frontend de GitHub Pages
  app.enableCors({
    origin: ['https://l20660042.github.io',
    'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Aquí usas el puerto dinámico de Railway
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Servidor escuchando en el puerto ${port}`);
}

bootstrap();
