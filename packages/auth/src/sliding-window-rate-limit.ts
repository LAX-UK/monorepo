/** Minimal Redis surface for sliding-window retry-after (sorted-set timestamps). */
export type SlidingWindowRedis = {
  zrange(key: string, start: number, stop: number, withScores: "WITHSCORES"): Promise<string[]>;
};

/** Seconds until the oldest blocking entry leaves the sliding window. */
export function computeSlidingWindowRetryAfterSec(opts: {
  oldestBlockingScoreMs: number;
  windowSec: number;
  nowMs?: number;
}): number {
  const now = opts.nowMs ?? Date.now();
  const windowMs = opts.windowSec * 1000;
  return Math.max(1, Math.ceil((opts.oldestBlockingScoreMs + windowMs - now) / 1000));
}

/**
 * Score (ms) of the entry whose expiry lets a fresh request succeed again.
 *
 * The window already contains the just-rejected request, and a future request
 * re-adds itself before the limit is checked, so it is only allowed once the
 * surviving entries drop to `max - 1`. That boundary is reached when the entry
 * at rank `excess` (0-indexed, `excess = count - max`) leaves the window.
 */
export async function oldestBlockingScoreMs(
  redis: SlidingWindowRedis,
  key: string,
  count: number,
  max: number,
): Promise<number | null> {
  const excess = count - max;
  if (excess <= 0) return null;
  const rank = excess;
  const entries = await redis.zrange(key, rank, rank, "WITHSCORES");
  const score = entries[1];
  if (score == null) return null;
  const ms = Number(score);
  return Number.isFinite(ms) ? ms : null;
}

export async function slidingWindowRetryAfterSec(
  redis: SlidingWindowRedis,
  key: string,
  windowSec: number,
  count: number,
  max: number,
  nowMs?: number,
): Promise<number> {
  const oldest = await oldestBlockingScoreMs(redis, key, count, max);
  if (oldest == null) return windowSec;
  return computeSlidingWindowRetryAfterSec(
    nowMs != null
      ? { oldestBlockingScoreMs: oldest, windowSec, nowMs }
      : { oldestBlockingScoreMs: oldest, windowSec },
  );
}
