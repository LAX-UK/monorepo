import { afterEach, describe, expect, it, vi } from "vitest";
import { startBackchannelLogoutSchedule } from "./backchannel-logout.schedule.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("back-channel logout schedule", () => {
  it("does not overlap drains and waits for the active drain when stopped", async () => {
    vi.useFakeTimers();
    let finishDrain: (() => void) | undefined;
    const drain = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          finishDrain = () => resolve(1);
        }),
    );
    const schedule = startBackchannelLogoutSchedule({
      service: { drain },
      onError: vi.fn(),
      intervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(40);
    expect(drain).toHaveBeenCalledOnce();

    const stopped = schedule.stop();
    let stopCompleted = false;
    void stopped.then(() => {
      stopCompleted = true;
    });
    await Promise.resolve();
    expect(stopCompleted).toBe(false);

    finishDrain?.();
    await stopped;
    expect(stopCompleted).toBe(true);
  });
});
