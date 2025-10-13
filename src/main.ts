import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permitir solicitudes desde el frontend de GitHub Pages
app.enableCors({
  origin: 'https://l20660042.github.io',  // Asegúrate de que esta URL sea la correcta
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});


  await app.listen(3000); // Asegúrate de que el backend esté escuchando en el puerto 3000
}
bootstrap();
