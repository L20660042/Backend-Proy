import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb+srv://luistoarzola_db_user:oPySQBXAF7EodFNX@proyecto.gdcgnsp.mongodb.net/'),
    MailModule,
    UsersModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}