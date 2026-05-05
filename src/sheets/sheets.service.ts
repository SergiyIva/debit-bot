import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { AppConfigService } from '../config/app-config.service.js';
import { createGoogleAuth } from './google-auth.provider.js';

export type SheetRow = [date: string, purpose: string, amount: number, comment: string];

const HEADERS = ['Дата', 'Назначение', 'Сумма', 'Комментарий'];

@Injectable()
export class SheetsService implements OnModuleInit {
  private readonly logger = new Logger(SheetsService.name);
  private sheets!: sheets_v4.Sheets;

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    const auth = createGoogleAuth(this.config.credentialsGoogle);
    this.sheets = google.sheets({ version: 'v4', auth });
    await this.ensureHeaders();
  }

  async ensureHeaders(): Promise<void> {
    const sheetName = this.config.sheetName;
    const spreadsheetId = this.config.spreadsheetId;

    const existing = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:D1`,
    });

    const current = existing.data.values?.[0] ?? [];
    const matches =
      current.length === HEADERS.length &&
      HEADERS.every((header, index) => current[index] === header);

    if (matches) {
      return;
    }

    this.logger.log(`Writing headers to ${sheetName}!A1:D1`);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:D1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }

  async appendRow(row: SheetRow): Promise<void> {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: `${this.config.sheetName}!A:D`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
  }
}
