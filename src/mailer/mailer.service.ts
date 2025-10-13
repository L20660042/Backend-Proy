import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,           // STARTTLS
      secure: false,       // false porque STARTTLS
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // tu contraseña de app (no la normal)
      },
      tls: {
        rejectUnauthorized: false, // importante en Railway
      },
    });
  }

  async sendVerificationEmail(email: string, code: string) {
    try {
      await this.transporter.sendMail({
        from: `"Mi App" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Código de verificación',
        html: `<h1>Tu código de verificación es: ${code}</h1>`,
      });
      console.log('Correo enviado a', email);
    } catch (error) {
      console.error('Error al enviar el correo:', error);
      throw error;
    }
  }
}
