import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SystemRole } from '../auth/roles.enum';

@Injectable()
export class UsersService {
  private readonly saltRounds = 10;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const exists = await this.userModel
      .findOne({ username: createUserDto.username })
      .lean();

    if (exists) {
      throw new ConflictException('El nombre de usuario ya existe');
    }

    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      this.saltRounds,
    );

    const user = new this.userModel({
      username: createUserDto.username,
      passwordHash,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: createUserDto.email,
      roles: createUserDto.roles?.length
        ? createUserDto.roles
        : [SystemRole.ALUMNO],
    });

    return user.save();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.username) user.username = dto.username;
    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName) user.lastName = dto.lastName;
    if (dto.email) user.email = dto.email;
    if (dto.roles) user.roles = dto.roles;
    if (dto.active !== undefined) user.active = dto.active;

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    }

    return user.save();
  }

  // 🔴 AQUÍ ESTÁ EL CAMBIO IMPORTANTE
  async findAll(): Promise<UserDocument[]> {
    return this.userModel
      .find()
      .select('-passwordHash') // ocultamos el hash
      .exec();                 // sin .lean()
  }

  async remove(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id).exec();
  }
}
