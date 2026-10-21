import type { FixedWindowCounter } from "../application/ports/fixed-window-counter.js";

const MAX_KEYS = 10_000;

/**
 * Per-process fallback when shop-api has no `REDIS_URL`: limits still hold on a single
 * instance, but each instance counts on its own.
 */
export function createInMemoryFixedWindowCounter(now: () => number = Date.now): FixedWindowCounter {
  const windows = new Map<string, { count: number; resetsAt: number }>();

  function evictExpired(at: number) {
    for (const [key, window] of windows) {
      if (window.resetsAt <= at) windows.delete(key);
    }
    while (windows.size >= MAX_KEYS) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) break;
      windows.delete(oldest);
    }
  }

  return {
    async increment(key, windowSeconds) {
      const at = now();
      let window = windows.get(key);
      if (!window || window.resetsAt <= at) {
        if (!window && windows.size >= MAX_KEYS) evictExpired(at);
        window = { count: 0, resetsAt: at + windowSeconds * 1000 };
        windows.set(key, window);
      }
      window.count += 1;
      return { count: window.count, resetInSeconds: Math.ceil((window.resetsAt - at) / 1000) };
    },
  };
}
