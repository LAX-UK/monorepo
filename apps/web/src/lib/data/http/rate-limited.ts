/** The API answered 429; `retryAfterMs` is its hint, when it sent one. */
export class RateLimitedError extends Error {
  constructor(readonly retryAfterMs: number | null = null) {
    super("Too many requests");
    this.name = "RateLimitedError";
  }
}

/** Reads `Retry-After` (seconds) from a 429 response into a `RateLimitedError`. */
export function rateLimitedFrom(res: Response): RateLimitedError {
  const seconds = Number(res.headers.get("retry-after"));
  return new RateLimitedError(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null);
}

/** Maps `items` with at most `size` calls in flight, so a long list does not trip rate limits. */
export async function mapInChunks<T, R>(
  items: readonly T[],
  size: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  }
  return out;
}
