import { Bot, type Context } from 'grammy';
import { hydrateFiles, type FileFlavor } from '@grammyjs/files';
import { HttpsProxyAgent } from 'https-proxy-agent';

export type BotContext = FileFlavor<Context>;

const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';

/**
 * Builds a grammy Bot. When `proxyUrl` is provided we route traffic through
 * the configured HTTP(S) proxy — necessary in regions where the Telegram Bot
 * API is unreachable from origin networks.
 *
 * Runtime quirk: grammy delegates to `globalThis.fetch`. The shape of the
 * proxy option differs by runtime:
 *   - Node.js + node-fetch: pass `agent: https.Agent` (we use HttpsProxyAgent).
 *   - Bun's native fetch  : pass `proxy: string` directly on RequestInit;
 *                           the `agent` field is silently ignored.
 * We pick the right field based on the active runtime so traffic actually
 * goes through the proxy in both environments.
 */
export function createTelegramBot(token: string, proxyUrl?: string): Bot<BotContext> {
  if (!proxyUrl) {
    const bot = new Bot<BotContext>(token);
    bot.api.config.use(hydrateFiles(bot.token));
    return bot;
  }

  const baseFetchConfig: Record<string, unknown> = isBun
    ? { proxy: proxyUrl }
    : { agent: new HttpsProxyAgent(proxyUrl) };

  const bot = new Bot<BotContext>(token, {
    client: { baseFetchConfig },
  });
  bot.api.config.use(hydrateFiles(bot.token));
  return bot;
}

/**
 * `PROXY_URL` may be either a plain proxy URL or a JSON-encoded array of URLs;
 * in the latter case we use the first one.
 */
export function parseFirstProxyUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
  } catch {
    // raw is a plain URL
  }
  return raw;
}
