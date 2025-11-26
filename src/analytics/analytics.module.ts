import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    JwtModule.register({ // Usar register en lugar de solo JwtModule
      secret: 'yourSecretKey',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [
    AnalyticsService,
    JwtAuthGuard,
  ],
  controllers: [AnalyticsController],
  exports: [AnalyticsService]
})
export class AnalyticsModule {}