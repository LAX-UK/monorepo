import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_EXPIRY_INTERVAL_MS,
  SESSION_EXPIRY_MAX_BATCHES_PER_RUN,
  SESSION_EXPIRY_STALL_ALERT_MS,
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

  describe("alerting on a stalled sweep", () => {
    const MINUTE = 60_000;

    it("alerts once the sweep has been failing for 10 minutes, and then at most every 10 minutes", async () => {
      const sweep = { batchSize: 5, run: vi.fn().mockRejectedValue(new Error("db down")) };
      const onError = vi.fn();
      const onStalled = vi.fn();
      const schedule = startSessionExpirySchedule({ sweep, onError, onStalled });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(9 * MINUTE);
      expect(onError).toHaveBeenCalledTimes(10);
      expect(onStalled).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(MINUTE);
      expect(onStalled).toHaveBeenCalledTimes(1);
      expect(onStalled).toHaveBeenCalledWith({ since: expect.any(Date), failed: true });
      await vi.advanceTimersByTimeAsync(5 * MINUTE);
      expect(onStalled).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5 * MINUTE);
      expect(onStalled).toHaveBeenCalledTimes(2);
      await schedule.stop();
    });

    it("alerts when the backlog is still there after 10 minutes of full runs", async () => {
      const sweep = { batchSize: 5, run: vi.fn(async () => 5) };
      const onStalled = vi.fn();
      const schedule = startSessionExpirySchedule({ sweep, onError: vi.fn(), onStalled });

      await vi.advanceTimersByTimeAsync(SESSION_EXPIRY_STALL_ALERT_MS - 1);
      expect(onStalled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(MINUTE);
      expect(onStalled).toHaveBeenCalledWith({ since: expect.any(Date), failed: false });
      await schedule.stop();
    });

    it("stays quiet when a clean run clears the backlog before 10 minutes, and starts counting again after", async () => {
      const sweep = { batchSize: 5, run: vi.fn(async () => 5) };
      const onStalled = vi.fn();
      const schedule = startSessionExpirySchedule({ sweep, onError: vi.fn(), onStalled });
      await vi.advanceTimersByTimeAsync(8 * MINUTE);
      sweep.run.mockImplementation(async () => 0);
      await vi.advanceTimersByTimeAsync(MINUTE);
      sweep.run.mockImplementation(async () => 5);
      await vi.advanceTimersByTimeAsync(8 * MINUTE);
      expect(onStalled).not.toHaveBeenCalled();
      await schedule.stop();
    });

    it("runs the after-sweep step on its own, so its failure is reported and never stops the sweep", async () => {
      const sweep = { batchSize: 5, run: vi.fn(async () => 0) };
      const afterSweep = vi
        .fn()
        .mockRejectedValueOnce(new Error("cap failed"))
        .mockResolvedValue(undefined);
      const onError = vi.fn();
      const schedule = startSessionExpirySchedule({ sweep, onError, afterSweep });

      await vi.advanceTimersByTimeAsync(0);
      expect(onError).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(SESSION_EXPIRY_INTERVAL_MS);
      expect(afterSweep).toHaveBeenCalledTimes(2);
      expect(sweep.run).toHaveBeenCalledTimes(2);
      await schedule.stop();
    });
  });
});
