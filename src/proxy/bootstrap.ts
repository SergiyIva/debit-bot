import { resolveProxyUrl } from './proxy.js';

/**
 * Side-effect import: applies the resolved proxy URL to standard
 * HTTP_PROXY / HTTPS_PROXY env vars so that arbitrary HTTP clients
 * (gaxios → google-auth-library, undici, Bun's native fetch) route traffic
 * through the proxy without per-client wiring.
 *
 * MUST be imported at the very top of main.ts — gaxios reads HTTPS_PROXY at
 * request time and crashes on an invalid value (e.g. a raw JSON array).
 * docker-compose's ${VAR} interpolation cannot expand a JSON array, so we
 * normalise it here, in the application process, instead.
 */
const url = resolveProxyUrl(process.env.PROXY_URL);
if (url) {
  process.env.HTTPS_PROXY = url;
  process.env.HTTP_PROXY = url;
  process.env.NO_PROXY ??= 'localhost,127.0.0.1';
}
