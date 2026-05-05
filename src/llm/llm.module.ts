import { Module } from '@nestjs/common';
import { OpenrouterService } from './openrouter.service.js';

@Module({
  providers: [OpenrouterService],
  exports: [OpenrouterService],
})
export class LlmModule {}
