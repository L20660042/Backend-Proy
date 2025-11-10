// app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { InstitutionModule } from './institution/institution.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb+srv://luistoarzola_db_user:oPySQBXAF7EodFNX@proyecto.gdcgnsp.mongodb.net/Proyecto'),
    UsersModule,
    InstitutionModule,
  ],
})
export class AppModule {}