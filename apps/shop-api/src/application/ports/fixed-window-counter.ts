/** Counts hits per key in fixed windows; the window starts with the first hit on a key. */
export interface FixedWindowCounter {
  increment(key: string, windowSeconds: number): Promise<{ count: number; resetInSeconds: number }>;
}
