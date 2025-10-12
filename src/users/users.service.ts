import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './create-user.dto';
import { MailerService } from '../mailer/mailer.service';  // Importa el MailerService

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private userModel: Model<User>,
    private readonly mailerService: MailerService,  // Asegúrate de que MailerService esté inyectado aquí
  ) {}

  async sendVerificationEmail(email: string): Promise<void> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();  // Genera un código aleatorio de 6 dígitos
    await this.mailerService.sendVerificationCode(email, code);  // Envia el código de validación al correo
    console.log('Código enviado:', code);
    // Aquí puedes guardar el código en la base de datos si es necesario para validarlo después
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { correo, pase, nombre, apellido, userType } = createUserDto;

    const hashedPassword = await bcrypt.hash(pase, 10);  // Encriptar la contraseña

    const user = new this.userModel({
      nombre,
      apellido,
      correo,
      password: hashedPassword,
      userType,  // Guardar el tipo de usuario
    });

    return await user.save();  // Guardar el usuario en la base de datos
  }
}
