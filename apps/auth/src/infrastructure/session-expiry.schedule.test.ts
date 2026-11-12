import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_EXPIRY_INTERVAL_MS,
  SESSION_EXPIRY_MAX_BATCHES_PER_RUN,
  startSessionExpirySchedule,
} from "./session-expiry.schedule.js";

describe("startSessionExpirySchedule", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sweeps at start-up and then every interval", async () => {
    const sweep = { batchSize: 10, run: vi.fn(async () => 0) };
    const schedule = startSessionExpirySchedule({ sweep, onError: vi.fn() });

    await vi.advanceTimersByTimeAsync(0);
    expect(sweep.run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SESSION_EXPIRY_INTERVAL_MS);
    expect(sweep.run).toHaveBeenCalledTimes(2);
    await schedule.stop();
  });

  it("keeps sweeping while batches come back full, up to a cap, and reports the total", async () => {
    const sweep = { batchSize: 5, run: vi.fn(async () => 5) };
    const onSwept = vi.fn();
    const schedule = startSessionExpirySchedule({ sweep, onError: vi.fn(), onSwept });

    await vi.advanceTimersByTimeAsync(0);

    expect(sweep.run).toHaveBeenCalledTimes(SESSION_EXPIRY_MAX_BATCHES_PER_RUN);
    expect(onSwept).toHaveBeenCalledWith(5 * SESSION_EXPIRY_MAX_BATCHES_PER_RUN);
    await schedule.stop();
  });

  it("stops at the first short batch", async () => {
    const sweep = { batchSize: 5, run: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(2) };
    const schedule = startSessionExpirySchedule({ sweep, onError: vi.fn() });

    await vi.advanceTimersByTimeAsync(0);

    expect(sweep.run).toHaveBeenCalledTimes(2);
    await schedule.stop();
  });

  it("reports a failed sweep and carries on at the next interval", async () => {
    const sweep = {
      batchSize: 5,
      run: vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValue(0),
    };
    const onError = vi.fn();
    const schedule = startSessionExpirySchedule({ sweep, onError });

    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(SESSION_EXPIRY_INTERVAL_MS);
    expect(sweep.run).toHaveBeenCalledTimes(2);
    await schedule.stop();
  });

  it("does not start a sweep while one is still running", async () => {
    let finish: (count: number) => void = () => undefined;
    const sweep = {
      batchSize: 5,
      run: vi.fn(
        () =>
          new Promise<number>((resolve) => {
            finish = resolve;
          }),
      ),
    };
    const schedule = startSessionExpirySchedule({ sweep, onError: vi.fn() });

    await vi.advanceTimersByTimeAsync(SESSION_EXPIRY_INTERVAL_MS * 3);
    expect(sweep.run).toHaveBeenCalledTimes(1);
    finish(0);
    await schedule.stop();
  });
});
