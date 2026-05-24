import 'reflect-metadata';
// Side-effect import — must precede any module that issues HTTP requests
// (googleapis, grammy, etc.) so HTTPS_PROXY/HTTP_PROXY are valid before use.
import './proxy/bootstrap.js';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: false,
  });
  app.enableShutdownHooks();
  Logger.log('Expense bot is running', 'Bootstrap');
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap application:', error);
  process.exit(1);
});
