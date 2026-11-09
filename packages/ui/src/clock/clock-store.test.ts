import { describe, expect, it, vi } from "vitest";
import { createClockSource } from "./clock-source.js";
import { type ClockSubscriber, type TimerPort, createClockStore } from "./clock-store.js";

/** A clock and timer the test moves by hand. */
function world(startMs = 1_000_012_400) {
  let now = startMs;
  let visible = true;
  const visibilityListeners = new Set<() => void>();
  let nextId = 1;
  const pending = new Map<number, { at: number; callback: () => void }>();
  const timers: TimerPort & { sets: number } = {
    sets: 0,
    set(callback, delay) {
      timers.sets++;
      const id = nextId++;
      pending.set(id, { at: now + delay, callback });
      return id;
    },
    clear(handle) {
      pending.delete(handle as number);
    },
  };
  const source = createClockSource({ wallNow: () => now, monotonicNow: () => now });
  const store = createClockStore({
    source,
    timers,
    visibility: {
      isVisible: () => visible,
      onChange(callback) {
        visibilityListeners.add(callback);
        return () => visibilityListeners.delete(callback);
      },
    },
  });
  return {
    store,
    timers,
    pendingCount: () => pending.size,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...pending.entries()]
          .filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]);
        now = Math.max(now, due[1].at);
        due[1].callback();
      }
      now = end;
    },
    setVisible(value: boolean) {
      visible = value;
      for (const listener of visibilityListeners) listener();
    },
    listenerCount: () => visibilityListeners.size,
  };
}

/** A subscriber whose text changes at the next multiple of `stepMs`. */
function everyStep(
  stepMs: number,
  notify = vi.fn(),
): ClockSubscriber & { notify: ReturnType<typeof vi.fn> } {
  return {
    nextChangeAt: (now) => (Math.floor(now / stepMs) + 1) * stepMs,
    notify,
  };
}

describe("createClockStore", () => {
  it("ten subscribers share one timer", () => {
    const w = world();
    for (let i = 0; i < 10; i++) w.store.subscribe(everyStep(1000));
    expect(w.pendingCount()).toBe(1);
  });

  it("the first tick lands on the next server second", () => {
    const w = world(1_000_012_400);
    const sub = everyStep(1000);
    w.store.subscribe(sub);
    w.advance(599);
    expect(sub.notify).not.toHaveBeenCalled();
    w.advance(1);
    expect(sub.notify).toHaveBeenCalledTimes(1);
    expect(w.store.now() % 1000).toBe(0);
  });

  it("minute subscribers wake once a minute, second subscribers do not wake them", () => {
    const w = world(1_000_000_000);
    const minute = everyStep(60_000);
    const second = everyStep(1000);
    w.store.subscribe(minute);
    w.store.subscribe(second);
    w.advance(60_000);
    expect(second.notify).toHaveBeenCalledTimes(60);
    expect(minute.notify).toHaveBeenCalledTimes(1);
  });

  it("only wakes the subscribers that are due", () => {
    const w = world(1_000_000_000);
    const minute = everyStep(60_000);
    const second = everyStep(1000);
    w.store.subscribe(minute);
    w.store.subscribe(second);
    w.advance(5_000);
    expect(minute.notify).not.toHaveBeenCalled();
    expect(second.notify).toHaveBeenCalledTimes(5);
  });

  it("a later subscriber with an earlier change moves the timer sooner", () => {
    const w = world(1_000_000_000);
    const minute = everyStep(60_000);
    w.store.subscribe(minute);
    const second = everyStep(1000);
    w.store.subscribe(second);
    w.advance(1_000);
    expect(second.notify).toHaveBeenCalledTimes(1);
  });

  it("sets no timer for a subscriber that will never change", () => {
    const w = world();
    w.store.subscribe({ nextChangeAt: () => null, notify: vi.fn() });
    expect(w.pendingCount()).toBe(0);
  });

  it("hidden means no timers; visible means one immediate read for everyone", () => {
    const w = world(1_000_000_000);
    const a = everyStep(1000);
    const b = everyStep(60_000);
    w.store.subscribe(a);
    w.store.subscribe(b);
    w.setVisible(false);
    expect(w.pendingCount()).toBe(0);
    w.advance(120_000);
    expect(a.notify).not.toHaveBeenCalled();
    w.setVisible(true);
    expect(a.notify).toHaveBeenCalledTimes(1);
    expect(b.notify).toHaveBeenCalledTimes(1);
    expect(w.pendingCount()).toBe(1);
  });

  it("the last unsubscribe clears the timer and stops listening for visibility", () => {
    const w = world();
    const stopA = w.store.subscribe(everyStep(1000));
    const stopB = w.store.subscribe(everyStep(1000));
    expect(w.listenerCount()).toBe(1);
    stopA();
    expect(w.pendingCount()).toBe(1);
    stopB();
    expect(w.pendingCount()).toBe(0);
    expect(w.listenerCount()).toBe(0);
  });

  it("an unsubscribed subscriber is not notified", () => {
    const w = world(1_000_000_000);
    const sub = everyStep(1000);
    const stop = w.store.subscribe(sub);
    stop();
    w.advance(5_000);
    expect(sub.notify).not.toHaveBeenCalled();
  });

  it("applies a larger correction and never counts the clock backwards", () => {
    const w = world(1_000_000_000);
    w.advance(10_000);
    const before = w.store.now();
    w.store.source.applyMeasurement(before - 4_000, before);
    expect(w.store.now()).toBe(before);
    w.advance(2_000);
    expect(w.store.now()).toBe(before);
    w.advance(3_000);
    expect(w.store.now()).toBe(before + 1_000);
  });
});
