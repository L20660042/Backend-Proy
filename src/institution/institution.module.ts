import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { InstitutionService } from './institution.service';
import { InstitutionController } from './institution.controller';
import { Institution, InstitutionSchema } from './institution.schema';
import { User, UserSchema } from '../users/user.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
      { name: User.name, schema: UserSchema }
    ]),
    JwtModule,
  ],
  providers: [InstitutionService, JwtAuthGuard],
  controllers: [InstitutionController],
  exports: [InstitutionService]
})
export class InstitutionModule {}