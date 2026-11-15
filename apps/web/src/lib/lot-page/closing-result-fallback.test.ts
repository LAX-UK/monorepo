import { CLOSING_STOP_ASKING_AFTER_MS } from "@auction/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ClosingFetchEnv,
  closingFetchDelay,
  startClosingFetches,
} from "./closing-result-fallback";

describe("closingFetchDelay", () => {
  it("doubles from 5 s to a 60 s cap", () => {
    const mid = () => 0.5;
    expect([0, 1, 2, 3, 4, 5, 9].map((n) => closingFetchDelay(n, mid))).toEqual([
      5000, 10000, 20000, 40000, 60000, 60000, 60000,
    ]);
  });

  it("moves each wait by at most 20% either way", () => {
    expect(closingFetchDelay(0, () => 0)).toBe(4000);
    expect(closingFetchDelay(0, () => 1)).toBe(6000);
    expect(closingFetchDelay(9, () => 0)).toBe(48000);
    expect(closingFetchDelay(9, () => 1)).toBe(72000);
  });
});

describe("startClosingFetches", () => {
  let hidden = false;
  let resume: (() => void) | null = null;

  function env(): ClosingFetchEnv {
    return {
      set: (cb, ms) => setTimeout(cb, ms),
      clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      nowMs: () => Date.now(),
      hidden: () => hidden,
      onResume: (cb) => {
        resume = cb;
        return () => {
          resume = null;
        };
      },
      random: () => 0.5,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T18:00:00.000Z"));
    hidden = false;
    resume = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks at 5, 15, 35 and 75 s past the close, then every minute, and stops when told", async () => {
    const fetchResult = vi.fn(async () => undefined);
    const stop = startClosingFetches(fetchResult, Date.now(), env());
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchResult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchResult).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchResult).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetchResult).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(fetchResult).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchResult).toHaveBeenCalledTimes(5);
    stop();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(fetchResult).toHaveBeenCalledTimes(5);
    expect(resume).toBeNull();
  });

  it("stops asking ten minutes past the close and leaves no timer running", async () => {
    const fetchResult = vi.fn(async () => undefined);
    startClosingFetches(fetchResult, Date.now(), env());
    await vi.advanceTimersByTimeAsync(CLOSING_STOP_ASKING_AFTER_MS);
    const asked = fetchResult.mock.calls.length;
    // 5, 15, 35, 75 s, then each minute to 9:15: twelve asks, none at or past ten minutes.
    expect(asked).toBe(12);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(fetchResult).toHaveBeenCalledTimes(asked);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("asks nothing for a page opened after the bound", async () => {
    const fetchResult = vi.fn(async () => undefined);
    startClosingFetches(fetchResult, Date.now() - CLOSING_STOP_ASKING_AFTER_MS, env());
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetchResult).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("asks nothing while the tab is hidden, and starts again from the first wait when shown", async () => {
    const fetchResult = vi.fn(async () => undefined);
    const stop = startClosingFetches(fetchResult, Date.now(), env());
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchResult).toHaveBeenCalledTimes(2);
    hidden = true;
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(fetchResult).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    hidden = false;
    resume?.();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchResult).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchResult).toHaveBeenCalledTimes(3);
    stop();
  });

  it("a tab that is hidden when the clock reaches zero sets no timer until it is shown", async () => {
    hidden = true;
    const fetchResult = vi.fn(async () => undefined);
    const stop = startClosingFetches(fetchResult, Date.now(), env());
    expect(vi.getTimerCount()).toBe(0);
    // Coming back online while still hidden asks nothing either.
    resume?.();
    expect(vi.getTimerCount()).toBe(0);
    hidden = false;
    resume?.();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchResult).toHaveBeenCalledTimes(1);
    stop();
  });

  it("a resume after the bound asks nothing more", async () => {
    const fetchResult = vi.fn(async () => undefined);
    startClosingFetches(fetchResult, Date.now(), env());
    await vi.advanceTimersByTimeAsync(CLOSING_STOP_ASKING_AFTER_MS + 1);
    const asked = fetchResult.mock.calls.length;
    resume?.();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetchResult).toHaveBeenCalledTimes(asked);
  });

  it("keeps backing off after failed asks", async () => {
    const fetchResult = vi.fn(async () => {
      throw new Error("offline");
    });
    const stop = startClosingFetches(fetchResult, Date.now(), env());
    await vi.advanceTimersByTimeAsync(35_000);
    expect(fetchResult).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(39_999);
    expect(fetchResult).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchResult).toHaveBeenCalledTimes(4);
    stop();
  });

  it("waits for a slow answer before scheduling the next ask", async () => {
    let answer: (() => void) | null = null;
    const fetchResult = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          answer = resolve;
        }),
    );
    const stop = startClosingFetches(fetchResult, Date.now(), env());
    await vi.advanceTimersByTimeAsync(5_000);
    resume?.();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchResult).toHaveBeenCalledTimes(1);
    (answer as (() => void) | null)?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchResult).toHaveBeenCalledTimes(2);
    stop();
  });
});
