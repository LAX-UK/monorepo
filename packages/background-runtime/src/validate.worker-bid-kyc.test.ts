import { describe, expect, it } from "vitest";
import { validateRuntimeOwnership } from "./validate.js";

describe("validateRuntimeOwnership worker bid compliance", () => {
  it("rejects absentee worker owner without KYC enforcement", () => {
    const result = validateRuntimeOwnership(
      {
        financeCronExecutionOwner: "api_rollback",
        lifecycleExecutionOwner: "worker",
        absenteeReplayOwner: "worker",
        xeroProjectorMode: "off",
        financeCronApiRollbackEnabled: true,
        workerAbsenteeReplayReady: true,
        workerLifecycleHandlersReady: true,
        workerBidKycEnforcementReady: false,
      },
      "worker",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected errors");
    expect(result.errors.some((e) => e.includes("KYC"))).toBe(true);
  });
});
