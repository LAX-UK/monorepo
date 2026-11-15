import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS,
  createLotLifecycleTickJob,
} from "./lot-lifecycle-tick.js";
import { isTransientConnectionError } from "./post-internal-cron-job.js";

let tick = createLotLifecycleTickJob();
const run = (log: unknown, now: () => number) =>
  tick({
    env: { LIFECYCLE_EXECUTION_OWNER: "api" } as never,
    apiBaseUrl: "http://api.test",
    cronSecret: "s",
    log: log as never,
    now,
  });

describe("lot lifecycle tick gateway failures", () => {
  beforeEach(() => {
    tick = createLotLifecycleTickJob();
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([502, 504])("swallows %i as a warning and reports it", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, text: async () => "" }));
    const log = { warn: vi.fn(), error: vi.fn() };
    await expect(run(log, () => 0)).resolves.toBe("swallowed_transient");
    expect(log.warn).toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("keeps 503 (cron_not_configured) on the skip path, healthy and never escalating", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "" }),
    );
    const log = { warn: vi.fn(), error: vi.fn() };
    await expect(run(log, () => 0)).resolves.toBe("ok");
    await expect(run(log, () => LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS * 10)).resolves.toBe("ok");
    expect(log.warn).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("cron_not_configured"),
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  it.each(["ECONNREFUSED", "ECONNRESET", "UND_ERR_SOCKET"])(
    "swallows %s as a warning",
    async (code) => {
      const err = Object.assign(new TypeError("fetch failed"), {
        cause: Object.assign(new Error("x"), { code }),
      });
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
      const log = { warn: vi.fn(), error: vi.fn() };
      await expect(run(log, () => 0)).resolves.toBe("swallowed_transient");
      expect(log.error).not.toHaveBeenCalled();
    },
  );

  it("reports a timeout as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("t", "TimeoutError")));
    const log = { warn: vi.fn(), error: vi.fn() };
    await expect(run(log, () => 0)).rejects.toThrow("failed:timeout");
    expect(log.error).toHaveBeenCalled();
  });

  it("returns ok on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await expect(run({ warn: vi.fn(), error: vi.fn() }, () => 0)).resolves.toBe("ok");
  });

  it("resets the window after a non-transient failure", async () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const respond = (status: number) =>
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status, text: async () => "" }),
      );
    respond(502);
    await run(log, () => 0);
    respond(500);
    await expect(run(log, () => 10_000)).rejects.toThrow("failed:500");
    respond(502);
    await expect(run(log, () => LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS + 5_000)).resolves.toBe(
      "swallowed_transient",
    );
  });

  it("treats connection refused as a warning", async () => {
    const err = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("x"), { code: "ECONNREFUSED" }),
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
    const log = { warn: vi.fn(), error: vi.fn() };
    await expect(run(log, () => 0)).resolves.toBe("swallowed_transient");
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
    await expect(run(log, () => 10_000 + LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS + 5)).resolves.toBe(
      "swallowed_transient",
    );
    expect(log.error).not.toHaveBeenCalled();
  });
});

describe("isTransientConnectionError", () => {
  it("matches reset/refused through cause, not timeouts", () => {
    expect(isTransientConnectionError({ cause: { code: "ECONNRESET" } })).toBe(true);
    expect(isTransientConnectionError(new Error("timeout"))).toBe(false);
  });
});
