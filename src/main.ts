import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permitir solicitudes desde el frontend que está en localhost:5173
  app.enableCors({
    origin: 'https://l20660042.github.io/Frontendproyecto/', // Este es el origen correcto de tu frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
    allowedHeaders: ['Content-Type', 'Authorization'], // Cabeceras permitidas
  });

  await app.listen(3000); // Asegúrate de que el backend esté escuchando en el puerto 3000
}
bootstrap();
