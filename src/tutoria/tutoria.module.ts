import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TutoriaService } from './tutoria.service';
import { TutoriaController } from './tutoria.controller';
import { Tutoria, TutoriaSchema } from './schemas/tutoria.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Tutoria.name, schema: TutoriaSchema }])],
  controllers: [TutoriaController],
  providers: [TutoriaService],
  exports: [TutoriaService],
})
export class TutoriaModule {}
