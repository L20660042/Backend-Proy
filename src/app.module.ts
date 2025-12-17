import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';


@Module({
  imports: [
    MongooseModule.forRoot('mongodb+srv://luistoarzola_db_user:oPySQBXAF7EodFNX@proyecto.gdcgnsp.mongodb.net/academico', {
      // useNewUrlParser: true, useUnifiedTopology: true (ya no se necesitan en versiones nuevas)
    }),

    // Módulos propios
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
