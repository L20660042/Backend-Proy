import { Module } from '@nestjs/common';
import { AiClientService } from './ai.client';

@Module({
  providers: [AiClientService],
  exports: [AiClientService],
})
export class AiModule {}
