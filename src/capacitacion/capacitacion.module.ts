import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CapacitacionService } from './capacitacion.service';
import { CapacitacionController } from './capacitacion.controller';
import { Capacitacion, CapacitacionSchema } from './schemas/capacitacion.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Capacitacion.name, schema: CapacitacionSchema }])],
  controllers: [CapacitacionController],
  providers: [CapacitacionService],
  exports: [CapacitacionService],
})
export class CapacitacionModule {}
