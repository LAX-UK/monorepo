import { describe, expect, it } from "vitest";
import { LOT_A, LOT_B, payable, planOf } from "./pay-plan-fixtures.test-util";
import { readPayPlanResponse } from "./pay-plan-read";
import { parsePayPlan } from "./pay-plan.schema";

const plan = planOf([payable(LOT_A, 190_000, 47_500)], {
  leftOut: [{ lotId: LOT_B, reason: "other_account" }],
});

describe("parsePayPlan", () => {
  it("reads the plan the API sends, unchanged", () => {
    expect(parsePayPlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });

  it("reads every gate the API can send", () => {
    const gates = [
      { kind: "clear" },
      { kind: "not_payer", payingAccountName: "Northbank Gallery" },
      { kind: "onboarding_required" },
      { kind: "refused", reason: "organisation_closed" },
      { kind: "held", reason: "identity_verification_required" },
      { kind: "held", reason: "organisation_under_review" },
      { kind: "compliance", reason: "aml_hold", subject: "winner" },
      { kind: "compliance", reason: "source_of_funds_required", subject: "payer" },
      { kind: "finance_check" },
    ];
    for (const gate of gates) expect(parsePayPlan({ ...plan, gate })).not.toBeNull();
  });

  it("is not a plan when a figure or a gate is unknown", () => {
    expect(parsePayPlan({ ...plan, gate: { kind: "something_new" } })).toBeNull();
    expect(parsePayPlan({ ...plan, totals: { ...plan.totals, pence: "2375.00" } })).toBeNull();
    expect(parsePayPlan(null)).toBeNull();
    expect(parsePayPlan({})).toBeNull();
  });
});

describe("readPayPlanResponse", () => {
  it("returns the plan from a successful answer", () => {
    expect(readPayPlanResponse(200, { data: plan })).toEqual({ kind: "ok", plan });
  });

  it("never turns an answer that is not a plan into one that can be paid", () => {
    expect(readPayPlanResponse(200, { data: { payable: [] } })).toEqual({ kind: "unavailable" });
    expect(readPayPlanResponse(200, null)).toEqual({ kind: "unavailable" });
    expect(readPayPlanResponse(503, { error: "pay_plan_unavailable" })).toEqual({
      kind: "unavailable",
    });
    expect(readPayPlanResponse(500, null)).toEqual({ kind: "unavailable" });
  });

  it("tells the refusals the reader can be told", () => {
    expect(
      readPayPlanResponse(403, { error: "Account suspended", code: "account_suspended" }),
    ).toEqual({ kind: "refused", reason: "suspended" });
    expect(readPayPlanResponse(403, { error: "bidding_not_allowed_for_role" })).toEqual({
      kind: "refused",
      reason: "staff",
    });
    expect(readPayPlanResponse(403, { error: "insufficient_entity_role" })).toEqual({
      kind: "refused",
      reason: "no_role",
    });
    for (const error of ["pay_several_empty", "pay_several_too_many", "pay_several_duplicate"]) {
      expect(readPayPlanResponse(400, { error })).toEqual({ kind: "refused", reason: "bad_pick" });
    }
  });
});
