import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mailer/mailer.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private userModel: Model<User>,
    private readonly mailService: MailService,
  ) {}

  // 1️⃣ Enviar código de verificación
  async sendVerificationEmail(email: string): Promise<void> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await this.userModel.findOneAndUpdate(
      { correo: email },
      { verificationCode: code, verificationCodeExpires: expires, isVerified: false },
      { upsert: true }
    );

    await this.mailService.sendVerificationEmail(email, code);
    console.log('Código enviado:', code);
  }

  // 2️⃣ Validar código de verificación
  async validateCode(email: string, code: string): Promise<boolean> {
    const user = await this.userModel.findOne({ correo: email });
    if (!user) return false;

    if (!user.verificationCode || user.verificationCode !== code) return false;
    if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) return false;

    // Código válido, marcar como verificado y limpiar campos
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    user.isVerified = true;
    await user.save();

    return true;
  }

  // 3️⃣ Crear usuario (solo si ya verificó el correo)
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { correo, pase, nombre, apellido, userType } = createUserDto;

    const user = await this.userModel.findOne({ correo });
    if (!user || !user.isVerified) {
      throw new Error('El correo no ha sido verificado');
    }

    const hashedPassword = await bcrypt.hash(pase, 10);

    user.nombre = nombre;
    user.apellido = apellido;
    user.password = hashedPassword;
    user.userType = userType;

    return await user.save();
  }
}
