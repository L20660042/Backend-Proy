import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configuramos el transporter para usar Gmail
    this.transporter = nodemailer.createTransport({
      service: 'gmail',  // Usamos el servicio Gmail
      auth: {
        user: 'luistoarzola@gmail.com',
        pass: 'afqx oilp saoi mneu', 
      },
      tls: {
        rejectUnauthorized: false,  // Permite conexiones seguras sin verificar el certificado (puede ser útil en entornos de desarrollo)
      },
      port: 465,  // Usar puerto 465 para conexiones seguras (SSL)
      secure: true,  // Usar SSL
      connectionTimeout: 10000,  // Tiempo de espera de conexión (10 segundos)
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
      // Enviamos el correo usando el transporter configurado
      await this.transporter.sendMail(mailOptions);  
      console.log('Correo enviado');
    } catch (error) {
      console.error('Error al enviar el correo:', error);
    }
  }
}
