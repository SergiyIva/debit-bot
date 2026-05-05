import { z } from 'zod';

const csvNumberList = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return [] as number[];
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const id = Number(part);
        if (!Number.isFinite(id)) {
          throw new Error(`TG_ALLOWED_USER_IDS contains non-numeric value: ${part}`);
        }
        return id;
      });
  });

export const envSchema = z.object({
  OPENROUTER_MODEL: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  TG_BOT_TOKEN: z.string().min(1),
  SPREADSHEET_ID: z.string().min(1),
  CREDENTIALS_GOOGLE: z.string().min(1),
  SHEET_NAME: z.string().min(1).default('Sheet1'),
  TG_ALLOWED_USER_IDS: csvNumberList,
  TZ: z.string().min(1).default('Europe/Moscow'),
  PORT: z.coerce.number().int().positive().default(3000),
  PROXY_URL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
