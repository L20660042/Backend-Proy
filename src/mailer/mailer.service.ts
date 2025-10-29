import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationCode(to: string, code: string) {
    const mailOptions = {
      from: `"Metricampus" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Código de verificación',
      text: `Tu código de verificación es: ${code}`,
    };

    return this.transporter.sendMail(mailOptions);
  }
}
