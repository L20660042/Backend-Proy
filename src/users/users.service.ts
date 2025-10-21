import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcryptjs';


@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private userModel: Model<User>
  ) {}



  
}
