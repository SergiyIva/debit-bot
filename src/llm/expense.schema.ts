import { z } from 'zod';

export const parsedExpenseSchema = z.object({
  date: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  comment: z.string().nullable().optional(),
});

export type ParsedExpense = z.infer<typeof parsedExpenseSchema>;

export type RawExpenseInput =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; buffer: Buffer; mime: string; format: string; caption?: string }
  | { kind: 'image'; buffer: Buffer; mime: string; caption?: string };
