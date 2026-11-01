import { afterEach, describe, expect, it, vi } from "vitest";
import { HEARTBEAT_INTERVAL_MS, startHeartbeat } from "./heartbeat.js";

describe("startHeartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits the server clock to every client on each beat", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const stop = startHeartbeat({ emit } as never, {
      now: () => new Date("2026-11-03T20:00:00.000Z"),
    });

    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("heartbeat", { serverNow: "2026-11-03T20:00:00.000Z" });
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    expect(emit).toHaveBeenCalledTimes(3);
    stop();
  });

  it("stops beating once stopped", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const stop = startHeartbeat({ emit } as never, { intervalMs: 1000 });
    stop();
    vi.advanceTimersByTime(5000);
    expect(emit).not.toHaveBeenCalled();
  });
});
