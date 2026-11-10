import { describe, expect, it, vi } from "vitest";
import { closingFetchDelays, startClosingFetches } from "./closing-result-fallback";

describe("closingFetchDelays", () => {
  it("is 5 s, every 5 s to 30 s, then every 15 s", () => {
    expect(closingFetchDelays(9)).toEqual([
      5000, 10000, 15000, 20000, 25000, 30000, 45000, 60000, 75000,
    ]);
  });
});

describe("startClosingFetches", () => {
  it("asks on that schedule and stops when told", async () => {
    vi.useFakeTimers();
    const fetchResult = vi.fn(async () => undefined);
    const stop = startClosingFetches(fetchResult);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchResult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchResult).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(fetchResult).toHaveBeenCalledTimes(6);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetchResult).toHaveBeenCalledTimes(6);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchResult).toHaveBeenCalledTimes(7);
    stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchResult).toHaveBeenCalledTimes(7);
    vi.useRealTimers();
  });

  it("keeps asking after a failed ask", async () => {
    vi.useFakeTimers();
    const fetchResult = vi.fn(async () => {
      throw new Error("offline");
    });
    const stop = startClosingFetches(fetchResult);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchResult).toHaveBeenCalledTimes(2);
    stop();
    vi.useRealTimers();
  });
});
