import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './user.schema'; // Asegúrate de importar tanto la interfaz como el esquema

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]), // Usa el nombre 'User' para el modelo
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
