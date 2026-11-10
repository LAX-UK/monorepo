/** The page asks for the result itself this long after the clock reaches zero. */
export const CLOSING_FIRST_FETCH_MS = 5_000;
/** Then every this often for the first thirty seconds. */
export const CLOSING_FETCH_EVERY_MS = 5_000;
/** And, if the server still has not said, every this often after that. */
export const CLOSING_SLOW_FETCH_EVERY_MS = 15_000;
const CLOSING_FAST_WINDOW_MS = 30_000;

/**
 * The delays, from the moment the lot reached zero, at which the page asks the server how the
 * lot ended: 5 s, then every 5 s up to 30 s, then every 15 s. `lot.closed` or the next snapshot
 * usually answers within a second, so these are only the safety net. Pure, for the test.
 */
export function closingFetchDelays(count: number): number[] {
  const delays: number[] = [];
  let at = CLOSING_FIRST_FETCH_MS;
  while (delays.length < count) {
    delays.push(at);
    at += at < CLOSING_FAST_WINDOW_MS ? CLOSING_FETCH_EVERY_MS : CLOSING_SLOW_FETCH_EVERY_MS;
  }
  return delays;
}

type Timers = {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
};

/**
 * Asks for the result on that schedule until stopped. Returns the stop. Each ask is one at a
 * time: a slow answer is waited for before the next is scheduled.
 */
export function startClosingFetches(
  fetchResult: () => Promise<unknown>,
  timers: Timers = {
    set: (cb, ms) => setTimeout(cb, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
): () => void {
  let stopped = false;
  let handle: unknown = null;
  let elapsed = 0;
  let next = CLOSING_FIRST_FETCH_MS;
  const schedule = () => {
    handle = timers.set(async () => {
      if (stopped) return;
      elapsed = next;
      try {
        await fetchResult();
      } catch {
        // The page keeps saying "Closing…" and asks again.
      }
      if (stopped) return;
      next =
        elapsed +
        (elapsed < CLOSING_FAST_WINDOW_MS ? CLOSING_FETCH_EVERY_MS : CLOSING_SLOW_FETCH_EVERY_MS);
      schedule();
    }, next - elapsed);
  };
  schedule();
  return () => {
    stopped = true;
    if (handle !== null) timers.clear(handle);
  };
}
