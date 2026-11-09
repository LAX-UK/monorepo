import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClockSource } from "./clock-source.js";
import { createClockStore } from "./clock-store.js";
import { createCountdownHook, useClockNow } from "./use-countdown.js";

type Display = { text: string; nextChangeInMs: number };

/** Shows whole seconds, so the text changes every second. */
const secondsPolicy = (_surface: "card", msLeft: number): Display => {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return { text: `${total}s`, nextChangeInMs: (msLeft % 1000) + 1 };
};

/** Shows minutes, so the text changes once a minute. */
const minutesPolicy = (_surface: "card", msLeft: number): Display => {
  const total = Math.max(0, Math.floor(msLeft / 60_000));
  return { text: `${total}m`, nextChangeInMs: (msLeft % 60_000) + 1 };
};

const START = new Date("2026-06-01T12:00:00.400Z").getTime();

let store: ReturnType<typeof createClockStore>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  store = createClockStore({
    source: createClockSource({ wallNow: () => Date.now(), monotonicNow: () => Date.now() }),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCountdown", () => {
  it("returns nothing on the server, so the first paint is the caller's placeholder", () => {
    const useCountdown = createCountdownHook(secondsPolicy, () => store);
    function Probe() {
      return <span>{useCountdown(START + 90_000, "card")?.text ?? "…"}</span>;
    }
    expect(renderToString(<Probe />)).toContain("…");
  });

  it("ticks with the clock and shows the time left", () => {
    const useCountdown = createCountdownHook(secondsPolicy, () => store);
    const { result } = renderHook(() => useCountdown(START + 90_000, "card"));
    expect(result.current?.text).toBe("90s");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current?.text).toBe("89s");
  });

  it("re-renders only when its own text changes", () => {
    const useCountdown = createCountdownHook(minutesPolicy, () => store);
    let renders = 0;
    renderHook(() => {
      renders++;
      return useCountdown(START + 10 * 60_000 + 30_000, "card");
    });
    const first = renders;
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(renders).toBe(first);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(renders).toBeGreaterThan(first);
  });

  it("many countdowns share one timer", () => {
    const useCountdown = createCountdownHook(secondsPolicy, () => store);
    const spy = vi.spyOn(globalThis, "setTimeout");
    const baseline = spy.mock.calls.length;
    for (let i = 0; i < 10; i++) renderHook(() => useCountdown(START + 120_000 + i, "card"));
    expect(spy.mock.calls.length - baseline).toBeLessThanOrEqual(10);
    // After they have all subscribed there is a single pending timer.
    expect(vi.getTimerCount()).toBe(1);
  });

  it("unsubscribes while its element is off screen and catches up on return", () => {
    let callback: (entries: Partial<IntersectionObserverEntry>[]) => void = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: typeof callback) {
          callback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const useCountdown = createCountdownHook(secondsPolicy, () => store);
    const element = document.createElement("div");
    const ref = { current: element };
    const { result } = renderHook(() => useCountdown(START + 90_000, "card", { inViewRef: ref }));
    expect(vi.getTimerCount()).toBe(1);

    act(() => callback([{ isIntersecting: false }]));
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    act(() => callback([{ isIntersecting: true }]));
    expect(result.current?.text).toBe("80s");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops timing once the countdown has no further change", () => {
    const useCountdown = createCountdownHook(
      (_s: "card", msLeft: number): { text: string; nextChangeInMs?: number } =>
        msLeft > 0 ? { text: "open", nextChangeInMs: msLeft + 1 } : { text: "closed" },
      () => store,
    );
    renderHook(() => useCountdown(START + 2_000, "card"));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useClockNow", () => {
  it("steps once per resolution, just after the step, and is null on the server", () => {
    function Probe() {
      return <span>{String(useClockNow(1000, {}, () => store))}</span>;
    }
    expect(renderToString(<Probe />)).toContain("null");
    const { result } = renderHook(() => useClockNow(1000, {}, () => store));
    const first = result.current;
    expect(first).toBe(START);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 400 ms into the second, the next step is at 13.001 s (one millisecond after the boundary).
    expect((result.current ?? 0) % 1000).toBe(1);
    expect(result.current).toBeGreaterThan(first ?? 0);
  });
});

describe("useClockTick", () => {
  it("re-renders only when the caller's own text is due to change", async () => {
    const { useClockTick } = await import("./use-countdown.js");
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useClockTick(
        (now) => 60_000 - (now % 60_000) + 1,
        { key: "a" },
        () => store,
      );
    });
    const first = renders;
    const before = result.current;
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(renders).toBe(first);
    expect(result.current).toBe(before);
    act(() => {
      vi.advanceTimersByTime(40_000);
    });
    expect(renders).toBeGreaterThan(first);
    expect((result.current ?? 0) - (before ?? 0)).toBeGreaterThanOrEqual(60_000 - 400);
  });

  it("stops timing when the caller says nothing more will change", async () => {
    const { useClockTick } = await import("./use-countdown.js");
    renderHook(() =>
      useClockTick(
        () => null,
        { key: "a" },
        () => store,
      ),
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
