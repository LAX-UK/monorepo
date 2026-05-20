import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWizardState } from "./use-wizard-state";

describe("useWizardState", () => {
  it("starts at step 0 and tracks dirty", () => {
    const { result } = renderHook(() => useWizardState(3));
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
    expect(result.current.dirty).toBe(false);
  });

  it("navigates next, prev, and goTo within bounds", () => {
    const { result } = renderHook(() => useWizardState(3));
    act(() => result.current.goNext());
    expect(result.current.stepIndex).toBe(1);
    act(() => result.current.goTo(2));
    expect(result.current.stepIndex).toBe(2);
    expect(result.current.isLast).toBe(true);
    act(() => result.current.goNext());
    expect(result.current.stepIndex).toBe(2);
    act(() => result.current.goPrev());
    expect(result.current.stepIndex).toBe(1);
    act(() => result.current.goTo(99));
    expect(result.current.stepIndex).toBe(2);
  });

  it("sets dirty flag", () => {
    const { result } = renderHook(() => useWizardState(2));
    act(() => result.current.setDirty(true));
    expect(result.current.dirty).toBe(true);
  });
});
