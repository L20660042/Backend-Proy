import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'luistoarzola@gmail.com',  // Tu correo de Gmail
        pass: 'afqx oilp saoi mneu',    // Contraseña de aplicación
      },
      port: 587,  // Puerto 587 para STARTTLS
      secure: false,  // No SSL, usamos STARTTLS
      tls: {
        rejectUnauthorized: false, // Permite conexiones sin verificar certificado (útil para desarrollo)
      },
      connectionTimeout: 20000,  // Aumentar el tiempo de espera de conexión
    });
  }

  // Método para enviar el código de verificación
  async sendVerificationCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: 'luistoarzola@gmail.com',  // Correo desde el que se envía
      to: email,  // Correo del destinatario
      subject: 'Código de Verificación',
      text: `Tu código de verificación es: ${code}`,  // El cuerpo del correo
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Correo enviado');
    } catch (error) {
      console.error('Error al enviar el correo:', error);
    }
  }
}
