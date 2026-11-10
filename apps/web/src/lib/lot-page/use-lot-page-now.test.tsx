import { useLotPageNow } from "@/lib/lot-page/use-lot-page-now";
import { createClockSource, createClockStore, replaceDefaultClockStore } from "@auction/ui/clock";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const START = Date.parse("2026-11-09T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  replaceDefaultClockStore(
    createClockStore({
      source: createClockSource({ wallNow: () => Date.now(), monotonicNow: () => Date.now() }),
    }),
  );
});
afterEach(() => {
  replaceDefaultClockStore(null);
  vi.useRealTimers();
});

describe("the lot page's structural clock", () => {
  it("does not re-render every second: a minute of ticking is no renders at all", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useLotPageNow(new Date(START).toISOString(), [
        START - 3_600_000,
        START + 3 * 3_600_000,
      ]);
    });
    const first = renders;
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(renders).toBe(first);
  });

  it("re-renders when the lot reaches zero, and not before", () => {
    const end = START + 30_000;
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useLotPageNow(null, [START - 3_600_000, end]);
    });
    const first = renders;
    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(renders).toBe(first);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(renders).toBeGreaterThan(first);
    expect(result.current).toBeGreaterThan(end);
  });

  it("re-renders at least hourly, so a 'today' or 'tomorrow' never goes stale", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useLotPageNow(null, [START + 100 * 3_600_000]);
    });
    const first = renders;
    act(() => {
      vi.advanceTimersByTime(3_600_001);
    });
    expect(renders).toBeGreaterThan(first);
  });

  it("uses the server's reading for the first paint", () => {
    const server = START + 5_000;
    const { result } = renderHook(() => useLotPageNow(new Date(server).toISOString(), []));
    // After the seed the shared clock runs from the server's reading, within a second of it.
    expect(Math.abs((result.current ?? 0) - server)).toBeLessThan(1_000);
  });
});
