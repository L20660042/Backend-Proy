import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://l20660042.github.io/Frontendproyecto', // Página pública exacta
      'https://l20660042.github.io',                  // Página raíz Github
      'http://localhost:5173'                        // Local testing
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Servidor escuchando en el puerto ${port}`);
}

bootstrap();
