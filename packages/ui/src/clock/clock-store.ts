import type { ClockSource } from "./clock-source.js";

/** What the store needs from a subscriber. */
export type ClockSubscriber = {
  /** The clock time at which this subscriber's output next changes, or null when it never will. */
  nextChangeAt(nowMs: number): number | null;
  /** The clock reached that moment (or the tab came back): read again. */
  notify(): void;
};

export type TimerPort = {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
};

export type VisibilityPort = {
  isVisible(): boolean;
  /** Calls back when the tab is shown or hidden. Returns the unsubscribe. */
  onChange(callback: () => void): () => void;
};

export type ClockStore = {
  /** The server-aligned time in milliseconds. */
  now(): number;
  subscribe(subscriber: ClockSubscriber): () => void;
  /** The server-aligned source, for the sync to feed. */
  readonly source: ClockSource;
};

const browserTimers: TimerPort = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const browserVisibility: VisibilityPort = {
  isVisible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
  onChange(callback) {
    if (typeof document === "undefined") return () => undefined;
    document.addEventListener("visibilitychange", callback);
    return () => document.removeEventListener("visibilitychange", callback);
  },
};

/**
 * One timer for every countdown on the page. It sleeps until the soonest moment any subscriber's
 * text will change, wakes then, and tells only the subscribers that are due. While the tab is
 * hidden there is no timer; when it is shown every subscriber reads again at once.
 */
export function createClockStore(options: {
  source: ClockSource;
  timers?: TimerPort;
  visibility?: VisibilityPort;
}): ClockStore {
  const { source } = options;
  const timers = options.timers ?? browserTimers;
  const visibility = options.visibility ?? browserVisibility;
  const due = new Map<ClockSubscriber, number>();
  let handle: unknown = null;
  let wakeAt = Number.POSITIVE_INFINITY;
  let stopVisibility: (() => void) | null = null;

  function clearTimer() {
    if (handle !== null) timers.clear(handle);
    handle = null;
    wakeAt = Number.POSITIVE_INFINITY;
  }

  /** Recompute every subscriber's next change and sleep until the soonest. */
  function schedule() {
    clearTimer();
    if (due.size === 0 || !visibility.isVisible()) return;
    const now = source.now();
    let soonest = Number.POSITIVE_INFINITY;
    for (const subscriber of due.keys()) {
      const at = subscriber.nextChangeAt(now);
      due.set(subscriber, at ?? Number.POSITIVE_INFINITY);
      if (at !== null && at < soonest) soonest = at;
    }
    if (!Number.isFinite(soonest)) return;
    wakeAt = soonest;
    handle = timers.set(wake, Math.max(1, soonest - now));
  }

  function wake() {
    handle = null;
    wakeAt = Number.POSITIVE_INFINITY;
    const now = source.now();
    for (const [subscriber, at] of [...due]) {
      if (at <= now) subscriber.notify();
    }
    schedule();
  }

  function onVisibilityChange() {
    if (!visibility.isVisible()) {
      clearTimer();
      return;
    }
    // Back on screen: one immediate read for everyone, then sleep again.
    for (const subscriber of [...due.keys()]) subscriber.notify();
    schedule();
  }

  return {
    source,
    now: () => source.now(),
    subscribe(subscriber) {
      if (due.size === 0) stopVisibility = visibility.onChange(onVisibilityChange);
      due.set(subscriber, Number.POSITIVE_INFINITY);
      if (visibility.isVisible()) {
        const at = subscriber.nextChangeAt(source.now());
        due.set(subscriber, at ?? Number.POSITIVE_INFINITY);
        // Only wake sooner; later subscribers do not move an earlier timer.
        if (at !== null && at < wakeAt) schedule();
      }
      return () => {
        due.delete(subscriber);
        if (due.size === 0) {
          clearTimer();
          stopVisibility?.();
          stopVisibility = null;
        }
      };
    },
  };
}
