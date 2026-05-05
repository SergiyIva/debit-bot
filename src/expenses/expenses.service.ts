import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { OpenrouterService } from '../llm/openrouter.service.js';
import type { ParsedExpense, RawExpenseInput } from '../llm/expense.schema.js';
import { SheetsService } from '../sheets/sheets.service.js';

export interface RecordedExpense {
  date: string;
  purpose: string;
  amount: number;
  comment: string;
}

export type ExpenseResult =
  | { ok: true; expense: RecordedExpense }
  | { ok: false; reason: string };

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly llm: OpenrouterService,
    private readonly sheets: SheetsService,
    private readonly config: AppConfigService,
  ) {}

  async process(input: RawExpenseInput): Promise<ExpenseResult> {
    let parsed: ParsedExpense;
    try {
      parsed = await this.llm.extractExpense(input);
    } catch (error) {
      this.logger.error(`LLM extraction failed: ${(error as Error).message}`);
      return { ok: false, reason: 'Не удалось обработать сообщение. Попробуй ещё раз.' };
    }

    if (parsed.amount == null || !parsed.purpose) {
      return {
        ok: false,
        reason: 'Не удалось распознать трату. Уточни сумму и назначение.',
      };
    }

    const expense: RecordedExpense = {
      date: this.formatDate(parsed.date),
      purpose: parsed.purpose.trim(),
      amount: Number(parsed.amount),
      comment: parsed.comment?.trim() ?? '',
    };

    try {
      await this.sheets.appendRow([
        expense.date,
        expense.purpose,
        expense.amount,
        expense.comment,
      ]);
    } catch (error) {
      this.logger.error(`Sheets append failed: ${(error as Error).message}`);
      return { ok: false, reason: 'Не удалось записать в таблицу. Попробуй ещё раз.' };
    }

    return { ok: true, expense };
  }

  private formatDate(rawIso: string | null | undefined): string {
    const source = rawIso ? new Date(rawIso) : new Date();
    const date = Number.isNaN(source.getTime()) ? new Date() : source;

    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: this.config.timezone,
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    // ru-RU locale yields "01.05.26"
    return formatter.format(date);
  }
}
