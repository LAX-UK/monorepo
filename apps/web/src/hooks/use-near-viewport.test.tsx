import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNearViewport } from "./use-near-viewport";

afterEach(() => {
  vi.unstubAllGlobals();
});

class QuietObserver {
  static margins: string[] = [];
  static callback: IntersectionObserverCallback | null = null;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    QuietObserver.callback = callback;
    QuietObserver.margins.push(options?.rootMargin ?? "");
  }
  observe = vi.fn();
  disconnect = vi.fn();
}

describe("useNearViewport", () => {
  it("stays false until the element comes near, then stays true", () => {
    vi.stubGlobal("IntersectionObserver", QuietObserver);
    const element = document.createElement("div");
    const { result, rerender } = renderHook(() => useNearViewport({ current: element }));
    expect(result.current).toBe(false);
    expect(QuietObserver.margins.at(-1)).toBe("100% 0px");

    const entry = (isIntersecting: boolean) =>
      [{ isIntersecting } as IntersectionObserverEntry] as IntersectionObserverEntry[];
    act(() => QuietObserver.callback?.(entry(false), {} as IntersectionObserver));
    expect(result.current).toBe(false);
    act(() => QuietObserver.callback?.(entry(true), {} as IntersectionObserver));
    expect(result.current).toBe(true);
    act(() => QuietObserver.callback?.(entry(false), {} as IntersectionObserver));
    rerender();
    expect(result.current).toBe(true);
  });

  it("answers true at once where IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const element = document.createElement("div");
    const { result } = renderHook(() => useNearViewport({ current: element }));
    expect(result.current).toBe(true);
  });
});
