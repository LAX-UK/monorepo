/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useScrollPastThreshold } from "./use-scroll-past-threshold";

describe("useScrollPastThreshold", () => {
  afterEach(() => {
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  });

  it("returns false before threshold and true after", () => {
    const { result } = renderHook(() => useScrollPastThreshold(100));
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(window, "scrollY", { value: 150, configurable: true, writable: true });
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current).toBe(true);
  });
});
