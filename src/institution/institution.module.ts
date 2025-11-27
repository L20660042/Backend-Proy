import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InstitutionService } from './institution.service';
import { InstitutionController } from './institution.controller';
import { Institution, InstitutionSchema } from './institution.schema';
import { User, UserSchema } from '../users/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
      { name: User.name, schema: UserSchema }
    ]),
    AuthModule, // Importar AuthModule
  ],
  providers: [InstitutionService],
  controllers: [InstitutionController],
  exports: [InstitutionService]
})
export class InstitutionModule {}