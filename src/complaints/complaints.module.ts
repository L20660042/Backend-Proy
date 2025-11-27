import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { Complaint, ComplaintSchema } from './complaint.schema';
import { User, UserSchema } from '../users/user.schema';
import { InstitutionModule } from '../institution/institution.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Complaint.name, schema: ComplaintSchema },
      { name: User.name, schema: UserSchema }
    ]),
    forwardRef(() => InstitutionModule),
    AuthModule, // Importar AuthModule
  ],
  providers: [ComplaintsService],
  controllers: [ComplaintsController],
  exports: [ComplaintsService]
})
export class ComplaintsModule {}