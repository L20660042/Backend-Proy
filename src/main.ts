import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://l20660042.github.io'
    ], // Orígenes permitidos
    methods: 'GET,POST,PUT,DELETE',  // Métodos permitidos
    allowedHeaders: 'Content-Type, Authorization', // Cabeceras permitidas
  });

  await app.listen(3000);
}
bootstrap();