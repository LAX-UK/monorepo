import { describe, expect, it } from "vitest";
import type { StepUpActionResult } from "./types";
import type { IStepUpCoordinator } from "./use-step-up-coordinator";
import { withStepUp } from "./with-step-up";

describe("withStepUp", () => {
  it("returns immediately on success", async () => {
    const coordinator: IStepUpCoordinator = {
      state: { mode: "idle", busy: false, error: null },
      request: async () => "satisfied",
      submitPassword: async () => {},
      cancel: () => {},
    };
    const r = await withStepUp(async () => ({ ok: true, value: 42 }), coordinator);
    expect(r).toEqual({ ok: true, value: 42 });
  });

  it("retries once after satisfied gate", async () => {
    let calls = 0;
    const coordinator: IStepUpCoordinator = {
      state: { mode: "idle", busy: false, error: null },
      request: async () => "satisfied",
      submitPassword: async () => {},
      cancel: () => {},
    };
    const r = await withStepUp(async (): Promise<StepUpActionResult<number>> => {
      calls += 1;
      if (calls === 1) return { ok: false, reason: "recent_auth_required" };
      return { ok: true, value: 1 };
    }, coordinator);
    expect(r).toEqual({ ok: true, value: 1 });
    expect(calls).toBe(2);
  });

  it("returns first failure when gate cancelled", async () => {
    let calls = 0;
    const coordinator: IStepUpCoordinator = {
      state: { mode: "idle", busy: false, error: null },
      request: async () => "cancelled",
      submitPassword: async () => {},
      cancel: () => {},
    };
    const first: StepUpActionResult<void> = { ok: false, reason: "credential_required" };
    const r = await withStepUp(async () => {
      calls += 1;
      return first;
    }, coordinator);
    expect(r).toEqual(first);
    expect(calls).toBe(1);
  });
});
