import { afterEach, describe, expect, it, vi } from "vitest";
import { startIdentityDeletionPurgeSchedule } from "./identity-deletion-purge.schedule.js";

const SUMMARY = { purged: ["a", "b"], held: 1, deferred: 0, reminded: 3 };

afterEach(() => {
  vi.useRealTimers();
});

describe("Identity deletion purge schedule", () => {
  it("runs at start-up and reports what the run did", async () => {
    const run = vi.fn().mockResolvedValue(SUMMARY);
    const onRun = vi.fn();
    const schedule = startIdentityDeletionPurgeSchedule({
      service: { run },
      onError: vi.fn(),
      onRun,
      intervalMs: 60_000,
    });
    await schedule.stop();

    expect(run).toHaveBeenCalledOnce();
    expect(onRun).toHaveBeenCalledWith(SUMMARY);
  });

  it("reports a failed run and keeps the schedule alive", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValueOnce(new Error("database unavailable"));
    run.mockResolvedValue(SUMMARY);
    const onError = vi.fn();
    const schedule = startIdentityDeletionPurgeSchedule({
      service: { run },
      onError,
      intervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(25);
    await schedule.stop();

    expect(onError).toHaveBeenCalledOnce();
    expect(run.mock.calls.length).toBeGreaterThan(1);
  });

  it("prevents overlapping runs and waits for the active purge when stopped", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const run = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(SUMMARY);
        }),
    );
    const schedule = startIdentityDeletionPurgeSchedule({
      service: { run },
      onError: vi.fn(),
      intervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(40);
    expect(run).toHaveBeenCalledOnce();

    const stopped = schedule.stop();
    finish?.();
    await stopped;
  });
});
