import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { AppConfigService } from '../config/app-config.service.js';
import { createGoogleAuth } from './google-auth.provider.js';
import { toSheetDate } from './sheet-date.js';

export type SheetRow = [date: string, purpose: string, amount: number, comment: string];

const HEADERS = ['Дата', 'Назначение', 'Сумма', 'Комментарий'];

@Injectable()
export class SheetsService implements OnModuleInit {
  private readonly logger = new Logger(SheetsService.name);
  private sheets!: sheets_v4.Sheets;
  private sheetId!: number;
  private operations: Promise<unknown> = Promise.resolve();

  private get sheetRange(): string {
    return `'${this.config.sheetName.replace(/'/g, "''")}'`;
  }

  // Appends must not race with conversion and sorting inside this bot instance.
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation);
    this.operations = result.catch(() => undefined);
    return result;
  }

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    const auth = createGoogleAuth(this.config.credentialsGoogle);
    this.sheets = google.sheets({ version: 'v4', auth });
    const metadata = await this.sheets.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });
    const sheet = metadata.data.sheets?.find((item) => item.properties?.title === this.config.sheetName);
    if (sheet?.properties?.sheetId == null) throw new Error('Configured sheet not found');
    this.sheetId = sheet.properties.sheetId;
    await this.ensureHeaders();
    await this.normalizeDates();
  }

  async ensureHeaders(): Promise<void> {
    const sheetName = this.config.sheetName;
    const spreadsheetId = this.config.spreadsheetId;

    const existing = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${this.sheetRange}!A1:D1`,
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
      range: `${this.sheetRange}!A1:D1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }

  async appendRow(row: SheetRow): Promise<void> {
    const date = toSheetDate(row[0]);
    await this.enqueue(() => this.sheets.spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: `${this.sheetRange}!A:D`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[date, ...row.slice(1)]] },
    }));
  }

  private async normalizeDates(): Promise<void> {
    // Read entered values so formulas and already numeric dates remain untouched.
    const existing = await this.sheets.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      ranges: [`${this.sheetRange}!A2:A`],
      includeGridData: true,
      fields: 'sheets.data(startRow,rowData.values.userEnteredValue)',
    });
    const requests: sheets_v4.Schema$Request[] = [];
    for (const grid of existing.data.sheets?.[0]?.data ?? []) {
      for (const [index, row] of (grid.rowData ?? []).entries()) {
        const text = row.values?.[0]?.userEnteredValue?.stringValue;
        if (!text?.trim()) continue;
        const rowIndex = (grid.startRow ?? 1) + index;
        let date: number;
        try {
          date = toSheetDate(text);
        } catch {
          throw new Error(`Cannot convert date in A${rowIndex + 1}; fix the date before sorting`);
        }
        requests.push({
          updateCells: {
            start: { sheetId: this.sheetId, rowIndex, columnIndex: 0 },
            rows: [{ values: [{ userEnteredValue: { numberValue: date } }] }],
            fields: 'userEnteredValue',
          },
        });
      }
    }
    requests.push({
      repeatCell: {
        range: { sheetId: this.sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd.MM.yy' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { requests },
    });
  }

  async sortByDate(): Promise<void> {
    await this.enqueue(async () => {
      await this.normalizeDates();
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: {
          requests: [{
            sortRange: {
              // All columns move together; row 1 (headers) stays in place.
              range: { sheetId: this.sheetId, startRowIndex: 1 },
              sortSpecs: [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }],
            },
          }],
        },
      });
    });
  }
}
