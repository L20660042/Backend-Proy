import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Career, CareerSchema } from './schemas/career.schema';
import { CareersController } from './careers.controller';
import { CareersService } from './careers.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Career.name, schema: CareerSchema }])],
  controllers: [CareersController],
  providers: [CareersService],
  exports: [CareersService],
})
export class CareersModule {}
