import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettledValue } from "./use-settled-value";

describe("useSettledValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("hands over the value only once it stops changing", () => {
    const { result, rerender } = renderHook(({ value }) => useSettledValue(value, 500), {
      initialProps: { value: "a" },
    });
    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(300));
    rerender({ value: "abc" });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("abc");
  });
});
