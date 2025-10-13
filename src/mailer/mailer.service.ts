import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  async sendVerificationEmail(to: string, code: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Metricampus" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Código de verificación - Metricampus',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Verificación de correo</h2>
          <p>Tu código de verificación es:</p>
          <h1 style="color: #007bff;">${code}</h1>
          <p>Expira en 10 minutos.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  }
}
