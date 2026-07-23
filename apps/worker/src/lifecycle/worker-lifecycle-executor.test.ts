import { describe, expect, it, vi } from "vitest";
import {
  assertLifecycleExecutionOwner,
  runWorkerOwnedLifecycleTick,
} from "./worker-lifecycle-executor.js";

describe("assertLifecycleExecutionOwner", () => {
  it("accepts api and worker owners", () => {
    expect(() => assertLifecycleExecutionOwner({ LIFECYCLE_EXECUTION_OWNER: "api" })).not.toThrow();
    expect(() =>
      assertLifecycleExecutionOwner({ LIFECYCLE_EXECUTION_OWNER: "worker" }),
    ).not.toThrow();
  });

  it("rejects invalid owner values", () => {
    expect(() =>
      assertLifecycleExecutionOwner({ LIFECYCLE_EXECUTION_OWNER: "both" as "api" }),
    ).toThrow(/LIFECYCLE_EXECUTION_OWNER/);
  });
});

describe("runWorkerOwnedLifecycleTick", () => {
  it("returns already_running when redis lock is held", async () => {
    const redis = {
      set: vi.fn().mockResolvedValue(null),
      del: vi.fn(),
    };
    const executor = {
      lotLifecycleService: { runTransitions: vi.fn() },
      saleLifecycleService: { reconcileSaleStatuses: vi.fn() },
    };
    const outcome = await runWorkerOwnedLifecycleTick({
      redis: redis as never,
      executor: executor as never,
    });
    expect(outcome).toEqual({ ok: false, reason: "lifecycle_tick_already_running" });
    expect(executor.lotLifecycleService.runTransitions).not.toHaveBeenCalled();
  });
});
