import { afterEach, describe, expect, it, vi } from "vitest";
import { runWhenIdle } from "./run-when-idle";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("runWhenIdle", () => {
  it("runs the task when the browser is idle, and can be cancelled", () => {
    const callbacks: Array<() => void> = [];
    const cancel = vi.fn();
    vi.stubGlobal("requestIdleCallback", (task: () => void) => callbacks.push(task));
    vi.stubGlobal("cancelIdleCallback", cancel);
    const task = vi.fn();

    const stop = runWhenIdle(task);
    expect(task).not.toHaveBeenCalled();
    callbacks[0]?.();
    expect(task).toHaveBeenCalledOnce();

    stop();
    expect(cancel).toHaveBeenCalled();
  });

  it("falls back to a short timer where the browser cannot say when it is idle", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const task = vi.fn();

    runWhenIdle(task);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(task).toHaveBeenCalledOnce();
  });

  it("does not run a cancelled task", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const task = vi.fn();

    runWhenIdle(task)();
    vi.advanceTimersByTime(5000);
    expect(task).not.toHaveBeenCalled();
  });
});
