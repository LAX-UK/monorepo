import { afterEach, describe, expect, it, vi } from "vitest";
import { startHeldErasureRecheckSchedule } from "./held-erasure-recheck.schedule.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("held erasure re-check schedule", () => {
  it("never overlaps runs, and waits for the active run when stopped", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const schedule = startHeldErasureRecheckSchedule({
      recheck: { run },
      onError: vi.fn(),
      intervalMs: 10,
    });
    await vi.advanceTimersByTimeAsync(40);
    expect(run).toHaveBeenCalledOnce();

    let completed = false;
    const stopped = schedule.stop().then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish?.();
    await stopped;
    expect(completed).toBe(true);
  });

  it("reports a failed run and runs again on the next tick", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const run = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(undefined);
    const schedule = startHeldErasureRecheckSchedule({ recheck: { run }, onError, intervalMs: 10 });
    await vi.advanceTimersByTimeAsync(15);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "down" }));
    expect(run).toHaveBeenCalledTimes(2);
    await schedule.stop();
  });
});
