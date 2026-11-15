import { CLOSING_STOP_ASKING_AFTER_MS } from "@auction/domain";

/** The page first asks for the result itself this long after the clock reaches zero. */
export const CLOSING_FIRST_FETCH_MS = 5_000;
/** Each later ask waits twice as long as the last, up to this. */
export const CLOSING_FETCH_CAP_MS = 60_000;
/** Each wait is moved by up to this share either way, so open tabs do not ask in step. */
export const CLOSING_FETCH_JITTER = 0.2;

/**
 * The wait before ask `attempt` (0 first): 5 s, 10 s, 20 s, 40 s, then every 60 s, each within
 * ±20%. `lot.closed` or the next snapshot usually answers within a second, so these are only the
 * safety net. Pure, for the test.
 */
export function closingFetchDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(CLOSING_FIRST_FETCH_MS * 2 ** attempt, CLOSING_FETCH_CAP_MS);
  return Math.round(base * (1 + CLOSING_FETCH_JITTER * (2 * random() - 1)));
}

export type ClosingFetchEnv = {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
  /** The server-aligned clock, the one the countdown reads. */
  nowMs(): number;
  hidden(): boolean;
  /** Calls back when the tab is shown again or the device comes back online. Returns the stop. */
  onResume(callback: () => void): () => void;
  random(): number;
};

function browserEnv(nowMs: () => number): ClosingFetchEnv {
  return {
    set: (cb, ms) => setTimeout(cb, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    nowMs,
    hidden: () => document.visibilityState === "hidden",
    onResume: (cb) => {
      const onVisible = () => {
        if (document.visibilityState === "visible") cb();
      };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("online", cb);
      return () => {
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("online", cb);
      };
    },
    random: Math.random,
  };
}

/**
 * Asks for the result, backing off, until stopped or until {@link CLOSING_STOP_ASKING_AFTER_MS}
 * past `closedAtMs`, when the row offers a refresh instead. Nothing is asked while the tab is
 * hidden; showing it again, or coming back online, starts again from the first wait. One ask at a
 * time: a slow answer is waited for before the next is scheduled. Returns the stop.
 */
export function startClosingFetches(
  fetchResult: () => Promise<unknown>,
  closedAtMs: number,
  env: ClosingFetchEnv | (() => number),
): () => void {
  const io = typeof env === "function" ? browserEnv(env) : env;
  let stopped = false;
  let busy = false;
  let handle: unknown = null;
  let attempt = 0;
  const due = () => !stopped && io.nowMs() - closedAtMs < CLOSING_STOP_ASKING_AFTER_MS;
  const schedule = () => {
    if (busy || handle !== null || !due() || io.hidden()) return;
    handle = io.set(
      async () => {
        handle = null;
        if (!due() || io.hidden()) return;
        busy = true;
        try {
          await fetchResult();
        } catch {
          // The page keeps saying it is confirming, and asks again later.
        }
        busy = false;
        attempt += 1;
        schedule();
      },
      closingFetchDelay(attempt, io.random),
    );
  };
  const stopResume = io.onResume(() => {
    attempt = 0;
    if (handle !== null) io.clear(handle);
    handle = null;
    schedule();
  });
  schedule();
  return () => {
    stopped = true;
    stopResume();
    if (handle !== null) io.clear(handle);
  };
}
