import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import type { StringValue } from 'ms';

function parseExpiresIn(raw?: string): number | StringValue {
  if (!raw) return 8 * 60 * 60;

  const trimmed = raw.trim();

  // si es número, lo tomamos como segundos
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return asNumber;

  // si no es número, asumimos formato tipo "8h", "15m", "30d"
  return trimmed as StringValue;
}

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET is required');

        return {
          secret,
          signOptions: { expiresIn: parseExpiresIn(config.get<string>('JWT_EXPIRES_IN')) },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
