import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer'; // ← ESTE

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Valida mínimamente variables (opcional)
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      // Evita loguear secretos; solo indica que faltan
      throw new Error('Faltan variables SMTP en el entorno de ejecución');
    }

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT) === 465, // true si usas 465
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  async sendCode(email: string, code: string) {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
      to: email,
      subject: 'Código de verificación',
      text: `Tu código es: ${code} (válido por 10 minutos)`,
    });
  }
}
