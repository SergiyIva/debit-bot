/**
 * Resolves a single proxy URL from a raw PROXY_URL value, which may be either:
 *   - a plain URL string:  "http://user:pass@host:port"
 *   - a JSON-encoded array: '["http://...","http://..."]'
 *
 * In array form we pick the first non-empty string. Returns undefined if the
 * input is empty / unparseable into a usable URL.
 */
export function resolveProxyUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        const first = parsed.find(
          (v): v is string => typeof v === 'string' && v.length > 0,
        );
        return first;
      }
    } catch {
      // fall through — treat as plain URL
    }
  }

  return trimmed;
}
