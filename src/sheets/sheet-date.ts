const DAY_MS = 86_400_000;
const SHEETS_EPOCH = Date.UTC(1899, 11, 30);

/** Parse the bot's day-first format without relying on the spreadsheet locale. */
export function toSheetDate(value: string): number {
  const match = /^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) throw new Error('Expected a date in dd.MM.yy or dd.MM.yyyy format');
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3]!.length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Invalid calendar date');
  }
  return (date.getTime() - SHEETS_EPOCH) / DAY_MS;
}
