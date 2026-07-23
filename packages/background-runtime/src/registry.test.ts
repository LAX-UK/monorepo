import { describe, expect, it } from "vitest";
import { BACKGROUND_OPERATION_REGISTRY } from "./registry.js";
import { validateRuntimeOwnership } from "./validate.js";

describe("BACKGROUND_OPERATION_REGISTRY", () => {
  it("has unique operation ids", () => {
    const ids = BACKGROUND_OPERATION_REGISTRY.map((op) => op.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("validateRuntimeOwnership", () => {
  it("rejects live xero with api rollback finance owner", () => {
    const result = validateRuntimeOwnership(
      {
        financeCronExecutionOwner: "api_rollback",
        lifecycleExecutionOwner: "api",
        absenteeReplayOwner: "api_rollback",
        xeroProjectorMode: "live",
        financeCronApiRollbackEnabled: false,
      },
      "worker",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects worker owner without local handlers when rollback disabled", () => {
    const result = validateRuntimeOwnership(
      {
        financeCronExecutionOwner: "worker",
        lifecycleExecutionOwner: "api",
        absenteeReplayOwner: "api_rollback",
        xeroProjectorMode: "off",
        financeCronApiRollbackEnabled: false,
        workerFinanceCronHandlersReady: false,
      },
      "worker",
    );
    expect(result.ok).toBe(false);
  });
});
