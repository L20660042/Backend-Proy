import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { RegisterUserDto } from './dto/register-user.dto';
import bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async register(dto: RegisterUserDto) {
    const exists = await this.userModel.findOne({ email: dto.email });
    if (exists) throw new ConflictException('El correo ya está registrado');

    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({ ...dto, password: hash });
    return { ok: true, userId: user._id };
  }
}
