import type { Clock } from "../ports.js";

interface Timer {
  readonly due: number;
  readonly resolve: () => void;
  readonly signal: AbortSignal | undefined;
  readonly onAbort: () => void;
}

/**
 * A clock that moves only when a test says so. `sleep` never waits in real time. `settle(promise)`
 * runs the clock forward, timer by timer, until the promise has finished, so a test can await a
 * call that backs off or times out without waiting for it.
 */
export class FakeClock implements Clock {
  private current: number;
  private timers: Timer[] = [];
  /** Every sleep that was asked for, in order: lets a test assert on backoff delays. */
  readonly sleeps: number[] = [];

  constructor(startMs = Date.UTC(2026, 10, 12, 9, 0, 0)) {
    this.current = startMs;
  }

  now(): number {
    return this.current;
  }

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    this.sleeps.push(ms);
    return new Promise<void>((resolve) => {
      if (signal?.aborted) return resolve();
      const timer: Timer = {
        due: this.current + Math.max(0, ms),
        resolve,
        signal,
        onAbort: () => {
          this.timers = this.timers.filter((t) => t !== timer);
          resolve();
        },
      };
      signal?.addEventListener("abort", timer.onAbort, { once: true });
      this.timers.push(timer);
    });
  }

  get pendingTimers(): number {
    return this.timers.length;
  }

  /** Move time forward, firing every timer that falls due on the way. */
  async advance(ms: number): Promise<void> {
    const target = this.current + ms;
    for (;;) {
      await flush();
      const next = this.earliest();
      if (!next || next.due > target) break;
      this.fire(next);
    }
    this.current = target;
    await flush();
  }

  /** Run the clock forward until `promise` settles, then return its value. Fails if it can never settle. */
  async settle<T>(promise: Promise<T>): Promise<T> {
    let done = false;
    const tracked = promise.finally(() => {
      done = true;
    });
    tracked.catch(() => undefined);
    for (let guard = 0; guard < 10_000; guard++) {
      await flush();
      if (done) return tracked;
      const next = this.earliest();
      if (!next)
        throw new Error("FakeClock.settle: promise is waiting for something that is not a timer");
      this.fire(next);
    }
    throw new Error("FakeClock.settle: did not settle");
  }

  private earliest(): Timer | undefined {
    return this.timers.reduce<Timer | undefined>(
      (a, b) => (a === undefined || b.due < a.due ? b : a),
      undefined,
    );
  }

  private fire(timer: Timer): void {
    this.timers = this.timers.filter((t) => t !== timer);
    timer.signal?.removeEventListener("abort", timer.onAbort);
    this.current = Math.max(this.current, timer.due);
    timer.resolve();
  }
}

/** Lets every pending promise callback run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
}
