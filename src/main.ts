import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: permite tu GH Pages y localhost
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://l20660042.github.io'
    ],
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
  });

  await app.listen(process.env.PORT || 8080);
}
bootstrap();
