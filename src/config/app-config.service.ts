import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema.js';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get openrouterApiKey(): string {
    return this.config.get('OPENROUTER_API_KEY', { infer: true });
  }

  get openrouterModel(): string {
    return this.config.get('OPENROUTER_MODEL', { infer: true });
  }

  get telegramBotToken(): string {
    return this.config.get('TG_BOT_TOKEN', { infer: true });
  }

  get spreadsheetId(): string {
    return this.config.get('SPREADSHEET_ID', { infer: true });
  }

  get credentialsGoogle(): string {
    return this.config.get('CREDENTIALS_GOOGLE', { infer: true });
  }

  get sheetName(): string {
    return this.config.get('SHEET_NAME', { infer: true });
  }

  get allowedUserIds(): number[] {
    return this.config.get('TG_ALLOWED_USER_IDS', { infer: true });
  }

  get timezone(): string {
    return this.config.get('TZ', { infer: true });
  }

  get proxyUrl(): string | undefined {
    return this.config.get('PROXY_URL', { infer: true });
  }
}
