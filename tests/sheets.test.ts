import 'reflect-metadata';
import { expect, test } from 'bun:test';
import type { sheets_v4 } from 'googleapis';
import type { CronJob } from 'cron';
import type { AppConfigService } from '../src/config/app-config.service.js';
import { toSheetDate } from '../src/sheets/sheet-date.js';
import { SheetsService } from '../src/sheets/sheets.service.js';
import { SheetsSortService } from '../src/sheets/sheets-sort.service.js';

function fixture(values: sheets_v4.Schema$ExtendedValue[] = []) {
  const requests: sheets_v4.Schema$Request[][] = [];
  const appends: any[] = [];
  const config = { sheetName: "Expenses'26", spreadsheetId: 'test', timezone: 'Europe/Moscow' } as AppConfigService;
  const service = new SheetsService(config);
  Object.assign(service, {
    sheetId: 7,
    sheets: { spreadsheets: {
      get: async () => ({ data: { sheets: [{ data: [{ startRow: 1,
        rowData: values.map((userEnteredValue) => ({ values: [{ userEnteredValue }] })),
      }] }] } }),
      batchUpdate: async (input: any) => { requests.push(input.requestBody.requests); return {}; },
      values: { append: async (input: any) => { appends.push(input); return {}; } },
    } },
  });
  return { service, config, requests, appends };
}

test('dates use the Sheets epoch and sort chronologically across months and years', () => {
  expect(toSheetDate('30.12.1899')).toBe(0);
  expect(toSheetDate('01.01.1900')).toBe(2);
  expect(toSheetDate('01.05.26')).toBe(46143);
  expect(toSheetDate('01.05.2026')).toBe(toSheetDate('01.05.26'));
  expect(toSheetDate('01.01.27')).toBeGreaterThan(toSheetDate('31.12.26'));
  expect(toSheetDate('01.03.24') - toSheetDate('28.02.24')).toBe(2);
});

test('impossible and ambiguous dates are rejected', () => {
  for (const value of ['29.02.2025', '31.04.26', '00.01.26', '01.13.26', '2026-05-01']) {
    expect(() => toSheetDate(value)).toThrow();
  }
});

test('append writes numeric dates and keeps text literal, including formula-like comments', async () => {
  const { service, appends } = fixture();
  await service.appendRow(['01.05.26', 'Coffee', 250, '=1+1']);
  expect(appends[0].valueInputOption).toBe('RAW');
  expect(appends[0].range).toBe("'Expenses''26'!A:D");
  expect(appends[0].requestBody.values).toEqual([[46143, 'Coffee', 250, '=1+1']]);
});

test('legacy date conversion preserves numeric dates and formulas; sorting moves all columns except headers', async () => {
  const { service, requests } = fixture([
    { stringValue: '01.05.26' }, { numberValue: 46142 }, { formulaValue: '=DATE(2026,5,2)' }, {},
  ]);
  await service.sortByDate();
  expect(requests[0]).toHaveLength(2);
  expect(requests[0]![0]!.updateCells).toEqual({
    start: { sheetId: 7, rowIndex: 1, columnIndex: 0 },
    rows: [{ values: [{ userEnteredValue: { numberValue: 46143 } }] }],
    fields: 'userEnteredValue',
  });
  expect(requests[0]![1]!.repeatCell?.cell?.userEnteredFormat?.numberFormat).toEqual({ type: 'DATE', pattern: 'dd.MM.yy' });
  expect(requests[1]![0]!.sortRange).toEqual({
    range: { sheetId: 7, startRowIndex: 1 },
    sortSpecs: [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }],
  });
});

test('invalid legacy dates prevent writes and sorting, without blocking subsequent appends', async () => {
  const { service, requests, appends } = fixture([{ stringValue: '31.02.26' }]);
  await expect(service.sortByDate()).rejects.toThrow('A2');
  expect(requests).toHaveLength(0);
  await service.appendRow(['01.05.26', 'Coffee', 250, '']);
  expect(appends).toHaveLength(1);
});

test('appends wait for sorting to complete', async () => {
  const { service, appends } = fixture();
  let release!: () => void;
  const blocker = new Promise<void>((resolve) => { release = resolve; });
  const api = (service as any).sheets;
  const originalGet = api.spreadsheets.get;
  api.spreadsheets.get = async () => { await blocker; return originalGet(); };
  const sort = service.sortByDate();
  const append = service.appendRow(['01.05.26', 'Coffee', 250, '']);
  await Promise.resolve();
  expect(appends).toHaveLength(0);
  release();
  await Promise.all([sort, append]);
  expect(appends).toHaveLength(1);
});

test('cron runs at 03:00 in TZ, invokes sorting and stops on shutdown', async () => {
  const { config, service, requests } = fixture();
  const scheduler = new SheetsSortService(config, service);
  scheduler.onApplicationBootstrap();
  const job = (scheduler as unknown as { job: CronJob }).job;
  try {
    const next = job.nextDate();
    expect(next.zoneName).toBe('Europe/Moscow');
    expect([next.hour, next.minute, next.second]).toEqual([3, 0, 0]);
    expect(job.waitForCompletion).toBe(true);
    await job.fireOnTick();
    expect(requests).toHaveLength(2);
  } finally {
    await scheduler.onApplicationShutdown();
  }
  expect(job.isActive).toBe(false);
});
