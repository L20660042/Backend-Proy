import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './user.schema';
import { PermissionsService } from './../Permisos/permissions.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.register({
      secret: 'yourSecretKey', 
      signOptions: { expiresIn: '24h' }, 
    }),
  ],
  providers: [UsersService, PermissionsService], 
  controllers: [UsersController],
  exports: [UsersService, JwtModule, PermissionsService]
})
export class UsersModule {}