import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './create-user.dto';
import { MailerService } from '../mailer/mailer.service'; // Importamos el servicio de correos electrónicos

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private userModel: Model<User>,
    private readonly mailerService: MailerService,  // Inyectamos el servicio de correos
  ) {}

  async validateCode(code: string): Promise<boolean> {
    // Aquí puedes usar una lógica para validar el código (por ejemplo, guardarlo en la base de datos o en memoria)
    return code === '123456'; // Validación simple del código (simulación)
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { correo, pase, nombre, apellido, userType } = createUserDto;

    const hashedPassword = await bcrypt.hash(pase, 10);

    const user = new this.userModel({
      nombre,
      apellido,
      correo,
      pase: hashedPassword,
      userType,
    });

    return await user.save();
  }

  async sendVerificationEmail(email: string): Promise<void> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // Generamos un código de 6 dígitos aleatorio
    await this.mailerService.sendVerificationCode(email, code);  // Enviamos el código al correo
    console.log('Código enviado:', code);
    // Aquí puedes guardar el código en la base de datos si es necesario para validar el código más tarde
  }
}
