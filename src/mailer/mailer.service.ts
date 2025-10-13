import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';

@Injectable()
export class MailService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });
  }

  async sendVerificationEmail(to: string, code: string) {
    const accessToken = await this.oauth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken.token || '',
      },
    });

    const mailOptions = {
      from: `"Metricampus" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Código de verificación - Metricampus',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Verificación de correo</h2>
          <p>Gracias por registrarte en <b>Metricampus</b>.</p>
          <p>Tu código de verificación es:</p>
          <h1 style="color: #007bff;">${code}</h1>
          <p>Este código expirará en 10 minutos.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Correo enviado a:', to);
  }
}
