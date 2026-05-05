import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module.js';
import { TelegramModule } from './telegram/telegram.module.js';

@Module({
  imports: [AppConfigModule, TelegramModule],
})
export class AppModule {}
