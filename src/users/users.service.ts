import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcryptjs';
import { MailerService } from '../mailer/mailer.service';  // Asegúrate de importar el MailerService

@Injectable()
export class UsersService {
  private verificationCode: string;  // Variable para almacenar el código de verificación

  constructor(
    @InjectModel('User') private userModel: Model<User>,
    private readonly mailerService: MailerService,
  ) {}

  // Método para enviar el código de verificación al correo del usuario
  async sendVerificationEmail(email: string): Promise<void> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();  // Generar código aleatorio
    this.verificationCode = code;  // Guardar el código de verificación en la memoria
    await this.mailerService.sendVerificationCode(email, code);  // Enviar correo
    console.log('Código enviado:', code);
  }

  // Método para validar el código ingresado por el usuario
  async validateCode(code: string): Promise<boolean> {
    // Compara el código ingresado con el código guardado
    return this.verificationCode === code;
  }

  // Método para crear un nuevo usuario
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
