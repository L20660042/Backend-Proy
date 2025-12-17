import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { Role } from '../auth/roles.enum';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  create(data: { email: string; passwordHash: string; roles: Role[]; status: 'pending'|'active'|'disabled' }) {
    return this.userModel.create({
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      roles: data.roles,
      status: data.status,
    });
  }
}
