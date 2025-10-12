import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './user.schema'; 
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),  
    MailerModule,  
  ],
  providers: [UsersService], 
  controllers: [UsersController],
})
export class UsersModule {}