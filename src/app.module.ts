import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';


@Module({
  imports: [
    MongooseModule.forRoot('mongodb+srv://luistoarzola_db_user:oPySQBXAF7EodFNX@proyecto.gdcgnsp.mongodb.net/'),
    UsersModule
  ],
})
export class AppModule {}
