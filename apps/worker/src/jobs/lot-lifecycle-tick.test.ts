import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS,
  resetLifecycleTickTransientState,
  runLotLifecycleTickJob,
} from "./lot-lifecycle-tick.js";
import { isTransientConnectionError } from "./post-internal-cron-job.js";

const run = (log: unknown, now: () => number) =>
  runLotLifecycleTickJob({
    env: { LIFECYCLE_EXECUTION_OWNER: "api" } as never,
    apiBaseUrl: "http://api.test",
    cronSecret: "s",
    log: log as never,
    now,
  });

describe("lot lifecycle tick gateway failures", () => {
  beforeEach(() => resetLifecycleTickTransientState());
  afterEach(() => vi.unstubAllGlobals());

  it.each([502, 503, 504])("treats %i as a warning, not an error", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, text: async () => "" }));
    const log = { warn: vi.fn(), error: vi.fn() };
    await expect(run(log, () => 0)).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("treats connection refused as a warning", async () => {
    const err = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("x"), { code: "ECONNREFUSED" }),
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
    const log = { warn: vi.fn(), error: vi.fn() };
    await expect(run(log, () => 0)).resolves.toBeUndefined();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("still reports 500 and 4xx as errors", async () => {
    for (const status of [500, 401]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status, text: async () => "" }),
      );
      const log = { warn: vi.fn(), error: vi.fn() };
      await expect(run(log, () => 0)).rejects.toThrow(`failed:${status}`);
      expect(log.error).toHaveBeenCalled();
    }
  });

  it("escalates after consecutive transient failures exceed the window", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "" }),
    );
    const log = { warn: vi.fn(), error: vi.fn() };
    await run(log, () => 1_000);
    await run(log, () => 1_000 + LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS);
    expect(log.error).not.toHaveBeenCalled();
    await expect(run(log, () => 1_001 + LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS)).rejects.toThrow(
      "failed:502",
    );
    expect(log.error).toHaveBeenCalled();
  });

  it("resets the window after a success", async () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "" }),
    );
    await run(log, () => 0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await run(log, () => 10_000);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "" }),
    );
    await expect(
      run(log, () => 10_000 + LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS + 5),
    ).resolves.toBeUndefined();
    expect(log.error).not.toHaveBeenCalled();
  });
});

describe("isTransientConnectionError", () => {
  it("matches reset/refused through cause, not timeouts", () => {
    expect(isTransientConnectionError({ cause: { code: "ECONNRESET" } })).toBe(true);
    expect(isTransientConnectionError(new Error("timeout"))).toBe(false);
  });
});
