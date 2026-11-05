import { TOP_BAR_HEIGHT_PX, useTopBarScrollAway } from "@/hooks/use-top-bar-scroll-away";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
    vi.runAllTimers();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

describe("useTopBarScrollAway", () => {
  it("moves the header up with the page, by no more than the 36px bar", () => {
    const header = document.createElement("header");
    renderHook(() => useTopBarScrollAway({ current: header }));
    const shift = () => header.style.getPropertyValue("--lax-top-bar-shift");
    expect(TOP_BAR_HEIGHT_PX).toBe(36);
    expect(shift()).toBe("0px");
    scrollTo(10);
    expect(shift()).toBe("10px");
    scrollTo(500);
    expect(shift()).toBe("36px");
    scrollTo(0);
    expect(shift()).toBe("0px");
  });

  it("stops listening when the header unmounts", () => {
    const header = document.createElement("header");
    const { unmount } = renderHook(() => useTopBarScrollAway({ current: header }));
    unmount();
    scrollTo(20);
    expect(header.style.getPropertyValue("--lax-top-bar-shift")).toBe("0px");
  });
});
