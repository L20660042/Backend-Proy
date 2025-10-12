import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configuramos el transporter para usar Gmail
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'Luistoarzola@gmail.com',  // Reemplaza con tu dirección de correo de Gmail
        pass: 'contraseña-de-aplicación',  // Aquí debes usar la contraseña de aplicación generada
      },
    });
  }

  // Método para enviar el código de verificación
  async sendVerificationCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: 'Luistoarzola@gmail.com',  // Correo desde el que se envía
      to: email,  // Correo del destinatario
      subject: 'Código de Verificación',
      text: `Tu código de verificación es: ${code}`,  // El cuerpo del correo
    };

    try {
      await this.transporter.sendMail(mailOptions);  // Enviamos el correo
      console.log('Correo enviado');
    } catch (error) {
      console.error('Error al enviar el correo:', error);
    }
  }
}
