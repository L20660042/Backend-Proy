import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './user.schema';  // Asegúrate de importar UserSchema correctamente

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),  // 'User' como nombre de entidad y el esquema UserSchema
  ],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
