export type RateLimiter = {
  /** Returns true if the request is allowed (slot consumed). */
  consume(key: string, now?: number): boolean;
};

export function createInMemorySlidingWindowRateLimiter(opts: {
  windowMs: number;
  maxPerWindow: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    consume(key, now = Date.now()) {
      const windowStart = now - opts.windowMs;
      const prevHits = (hits.get(key) ?? []).filter((t) => t > windowStart);
      if (prevHits.length >= opts.maxPerWindow) return false;
      prevHits.push(now);
      hits.set(key, prevHits);
      return true;
    },
  };
}
