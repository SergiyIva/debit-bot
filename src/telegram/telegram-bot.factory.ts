import { Bot, type Context } from 'grammy';
import { hydrateFiles, type FileFlavor } from '@grammyjs/files';
import { HttpsProxyAgent } from 'https-proxy-agent';

export type BotContext = FileFlavor<Context>;

/**
 * Builds a grammy Bot. When `proxyUrl` is provided we route traffic through
 * an HttpsProxyAgent — necessary in regions where the Telegram Bot API is
 * unreachable from origin networks.
 *
 * NOTE: grammy on Node uses `node-fetch` under the hood (see
 * grammy/out/shim.node.js). `node-fetch` recognises the `agent` field on
 * RequestInit, NOT `dispatcher` from undici, so we must pass an
 * `https.Agent`-compatible agent here.
 */
export function createTelegramBot(token: string, proxyUrl?: string): Bot<BotContext> {
  const bot = proxyUrl
    ? new Bot<BotContext>(token, {
        client: {
          baseFetchConfig: {
            agent: new HttpsProxyAgent(proxyUrl),
          } as Record<string, unknown>,
        },
      })
    : new Bot<BotContext>(token);

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
