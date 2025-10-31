import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { RegisterUserDto } from './dto/register-user.dto';
import bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private mail: MailService,
  ) {}

  // mem-store de códigos (en prod usa una colección con TTL o Redis)
  private codes = new Map<string, { code: string; exp: number }>();

  private genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

  async sendVerificationCode(email: string) {
    const code = this.genCode();
    this.codes.set(email, { code, exp: Date.now() + 10 * 60 * 1000 });
    try {
      await this.mail.sendCode(email, code);
    } catch {
      throw new BadRequestException('No se pudo enviar el código');
    }
    return { ok: true };
  }

  validateCode(email: string, code: string) {
    const entry = this.codes.get(email);
    if (!entry) throw new BadRequestException('Solicita un código primero');
    if (Date.now() > entry.exp) { this.codes.delete(email); throw new BadRequestException('Código expirado'); }
    if (entry.code !== code) throw new BadRequestException('Código inválido');
    return { ok: true };
  }

  async register(dto: RegisterUserDto) {
    const exists = await this.userModel.findOne({ email: dto.email });
    if (exists) throw new ConflictException('El correo ya está registrado');

    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({ ...dto, password: hash });
    return { ok: true, userId: user._id };
  }
}
