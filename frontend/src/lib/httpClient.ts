/** 輕量 fetch wrapper：AbortSignal 逾時、可選重試（弱網情境）。 */

const DEFAULT_MS = 25_000;

export function isProbablyTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === 'AbortError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed')
  );
}

export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_MS, signal: outer, ...rest } = init;
  const ctrl = new AbortController();
  const to = window.setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    if (outer) {
      if (outer.aborted) {
        ctrl.abort();
      } else {
        outer.addEventListener('abort', () => ctrl.abort(), { once: true });
      }
    }
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    window.clearTimeout(to);
  }
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; delayMs?: number; shouldRetry?: (e: unknown) => boolean },
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const delayMs = opts.delayMs ?? 800;
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const ok = opts.shouldRetry?.(e) ?? isProbablyTransientNetworkError(e);
      if (!ok || i === attempts - 1) throw e;
      await new Promise((r) => window.setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}
