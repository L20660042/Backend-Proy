import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';              // Ajusta el path si es necesario
import { MailService } from '../mailer/mailer.service'; // Servicio de correo
import { CreateUserDto } from './create-user.dto';  // DTO para registro

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private mailService: MailService,
  ) {}

  async sendVerificationCode(email: string) {
    let user = await this.userModel.findOne({ correo: email });
    // Si no existe, crear usuario provisional
    if (!user) {
      user = new this.userModel({ correo: email });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = code;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60000); // 15 minutos
    await user.save();

    try {
      await this.mailService.sendVerificationCode(email, code);
      return { message: 'Código enviado' };
    } catch (error) {
      throw new BadRequestException('Error al enviar el correo');
    }
  }

  async validateVerificationCode(email: string, code: string) {
    const user = await this.userModel.findOne({ correo: email });
    if (
      !user ||
      user.verificationCode !== code ||
      !user.verificationCodeExpires ||
      user.verificationCodeExpires < new Date()
    ) {
      throw new BadRequestException('Código inválido o expirado');
    }
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();
    return { message: 'Correo verificado correctamente' };
  }

  async isEmailVerified(email: string): Promise<boolean> {
    const user = await this.userModel.findOne({ correo: email });
    return user?.isVerified || false;
  }

  async create(createUserDto: CreateUserDto) {
    // Verifica si el correo ya está verificado
    const verified = await this.isEmailVerified(createUserDto.correo);
    if (!verified) throw new BadRequestException('El correo no está verificado');

    // Crea usuario definitivo
    const createdUser = new this.userModel({
      nombre: createUserDto.nombre,
      apellido: createUserDto.apellido,
      correo: createUserDto.correo,
      password: createUserDto.pase,
      userType: createUserDto.userType,
      isVerified: true
    });
    return createdUser.save();
  }
}
