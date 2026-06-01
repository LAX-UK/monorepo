import { describe, expect, it } from "vitest";
import type { AmlHoldReason, AmlHoldStatus } from "./aml-types.js";
import type { IAmlHoldStore } from "./ports.js";
import {
  AmlSettlementCompliancePolicy,
  type ISourceOfFundsGate,
} from "./settlement-compliance.policy.js";

function holdStore(
  hold: { status: AmlHoldStatus; reason: AmlHoldReason | null } | null,
): IAmlHoldStore {
  return {
    setHold: async () => {},
    clearHold: async () => {},
    getHold: async () => hold,
  };
}

function sofGate(requires: boolean): ISourceOfFundsGate {
  return { requiresSourceOfFunds: async () => requires };
}

const input = { buyerUserId: "u1", amountPence: 50_000 };

describe("AmlSettlementCompliancePolicy", () => {
  it("does not hold when no AML hold and no SoF gate", async () => {
    const policy = new AmlSettlementCompliancePolicy(holdStore({ status: "none", reason: null }));
    expect(await policy.evaluate(input)).toEqual({ hold: false, reason: null });
  });

  it("does not hold when the hold store returns null", async () => {
    const policy = new AmlSettlementCompliancePolicy(holdStore(null));
    expect(await policy.evaluate(input)).toEqual({ hold: false, reason: null });
  });

  it("holds with aml_hold reason on an active screening hold", async () => {
    const policy = new AmlSettlementCompliancePolicy(
      holdStore({ status: "hold", reason: "screening_review" }),
    );
    expect(await policy.evaluate(input)).toEqual({ hold: true, reason: "aml_hold" });
  });

  it("holds with aml_hold reason on a confirmed block", async () => {
    const policy = new AmlSettlementCompliancePolicy(
      holdStore({ status: "blocked", reason: "sanctions_match" }),
    );
    expect(await policy.evaluate(input)).toEqual({ hold: true, reason: "aml_hold" });
  });

  it("prefers the AML hold over a SoF requirement", async () => {
    const policy = new AmlSettlementCompliancePolicy(
      holdStore({ status: "hold", reason: "pep_match" }),
      sofGate(true),
    );
    expect(await policy.evaluate(input)).toEqual({ hold: true, reason: "aml_hold" });
  });

  it("holds with source_of_funds_required when SoF is owed and no AML hold", async () => {
    const policy = new AmlSettlementCompliancePolicy(
      holdStore({ status: "none", reason: null }),
      sofGate(true),
    );
    expect(await policy.evaluate(input)).toEqual({
      hold: true,
      reason: "source_of_funds_required",
    });
  });

  it("does not hold when SoF gate is satisfied", async () => {
    const policy = new AmlSettlementCompliancePolicy(
      holdStore({ status: "none", reason: null }),
      sofGate(false),
    );
    expect(await policy.evaluate(input)).toEqual({ hold: false, reason: null });
  });
});
