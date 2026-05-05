import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Bot, GrammyError, HttpError } from 'grammy';
import { AppConfigService } from '../config/app-config.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import type { RawExpenseInput } from '../llm/expense.schema.js';
import {
  type BotContext,
  createTelegramBot,
  parseFirstProxyUrl,
} from './telegram-bot.factory.js';

// `file.download(path)` is added by `@grammyjs/files`. We model only the bits
// we use here.
interface HydratedFile {
  download(path: string): Promise<string>;
}

@Injectable()
export class TelegramService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot<BotContext>;

  constructor(
    private readonly config: AppConfigService,
    private readonly expenses: ExpensesService,
  ) {
    const proxyUrl = parseFirstProxyUrl(this.config.proxyUrl);
    if (proxyUrl) {
      this.logger.log(`Routing Telegram traffic through proxy ${proxyUrl}`);
    }
    this.bot = createTelegramBot(this.config.telegramBotToken, proxyUrl);
  }

  async onApplicationBootstrap(): Promise<void> {
    this.registerMiddlewares();
    this.registerHandlers();
    this.bot.catch((err) => {
      const ctx = err.ctx;
      const e = err.error;
      if (e instanceof GrammyError) {
        this.logger.error(
          `Telegram API error in update ${ctx.update.update_id}: ${e.description}`,
        );
      } else if (e instanceof HttpError) {
        this.logger.error(`Telegram HTTP error: ${e.message}`);
      } else {
        this.logger.error(`Unexpected bot error: ${(e as Error).message}`);
      }
    });

    // Start long polling without awaiting (start() resolves only on bot.stop()).
    void this.bot.start({
      onStart: (info) => this.logger.log(`Telegram bot @${info.username} started`),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot.stop();
    this.logger.log('Telegram bot stopped');
  }

  private registerMiddlewares(): void {
    const allowed = this.config.allowedUserIds;
    if (allowed.length > 0) {
      const allowedSet = new Set(allowed);
      this.bot.use(async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId || !allowedSet.has(userId)) {
          this.logger.warn(`Rejected update from user ${userId ?? 'unknown'}`);
          return;
        }
        await next();
      });
    }
  }

  private registerHandlers(): void {
    this.bot.command('start', (ctx) =>
      ctx.reply(
        'Привет! Пришли мне трату текстом, голосом или фото чека — я запишу её в таблицу.',
      ),
    );

    this.bot.on('message:text', async (ctx) => {
      // Skip commands
      if (ctx.message.text.startsWith('/')) return;
      await this.handle(ctx, { kind: 'text', text: ctx.message.text });
    });

    this.bot.on('message:voice', async (ctx) => {
      const file = await ctx.getFile();
      const buffer = await this.downloadFile(file as unknown as HydratedFile);
      await this.handle(ctx, {
        kind: 'audio',
        buffer,
        mime: ctx.message.voice.mime_type ?? 'audio/ogg',
        format: 'ogg',
        caption: ctx.message.caption,
      });
    });

    this.bot.on('message:audio', async (ctx) => {
      const file = await ctx.getFile();
      const buffer = await this.downloadFile(file as unknown as HydratedFile);
      const mime = ctx.message.audio.mime_type ?? 'audio/mpeg';
      await this.handle(ctx, {
        kind: 'audio',
        buffer,
        mime,
        format: this.detectAudioFormat(mime),
        caption: ctx.message.caption,
      });
    });

    this.bot.on('message:photo', async (ctx) => {
      const file = await ctx.getFile();
      const buffer = await this.downloadFile(file as unknown as HydratedFile);
      await this.handle(ctx, {
        kind: 'image',
        buffer,
        mime: 'image/jpeg',
        caption: ctx.message.caption,
      });
    });
  }

  private async handle(ctx: BotContext, input: RawExpenseInput): Promise<void> {
    await ctx.replyWithChatAction('typing').catch(() => undefined);
    const result = await this.expenses.process(input);

    if (!result.ok) {
      await ctx.reply(`⚠️ ${result.reason}`);
      return;
    }

    const { date, purpose, amount, comment } = result.expense;
    const lines = [
      '✅ Записал:',
      `• Дата: ${date}`,
      `• Назначение: ${purpose}`,
      `• Сумма: ${amount}`,
    ];
    if (comment) {
      lines.push(`• Комментарий: ${comment}`);
    }
    await ctx.reply(lines.join('\n'));
  }

  /**
   * Downloads a Telegram file via `@grammyjs/files`. The plugin reuses grammy's
   * HTTP client, which means traffic respects the `PROXY_URL` configured at
   * Bot construction time.
   */
  private async downloadFile(file: HydratedFile): Promise<Buffer> {
    const dir = await mkdtemp(join(tmpdir(), 'tg-file-'));
    const path = join(dir, 'payload.bin');
    try {
      await file.download(path);
      return await readFile(path);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private detectAudioFormat(mime: string): string {
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
    if (mime.includes('wav')) return 'wav';
    if (mime.includes('webm')) return 'webm';
    if (mime.includes('m4a') || mime.includes('mp4')) return 'm4a';
    return 'ogg';
  }
}
