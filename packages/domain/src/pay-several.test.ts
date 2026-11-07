import type { PayPlanLeftOutReason } from "@auction/types";
import { describe, expect, it } from "vitest";
import { PAY_PLAN_MAX_LOTS } from "./pay-plan.js";
import { PAY_SEVERAL_MAX_INVOICES, paySeveralSkipReason } from "./pay-several.js";

describe("Pay several limits", () => {
  it("covers as many invoices as the pay plan", () => {
    expect(PAY_SEVERAL_MAX_INVOICES).toBe(PAY_PLAN_MAX_LOTS);
  });
});

describe("paySeveralSkipReason", () => {
  const cases: [PayPlanLeftOutReason, string][] = [
    ["other_account", "other_account"],
    ["not_payer", "not_payer"],
    ["held_for_review", "held_for_review"],
    ["being_paid", "being_paid"],
    ["paid", "not_owed"],
    ["being_confirmed", "not_owed"],
    ["cancelled", "not_owed"],
    ["refunded", "not_owed"],
    ["voided", "not_owed"],
  ];
  it.each(cases)("tells a plan reason %s as %s", (reason, expected) => {
    expect(paySeveralSkipReason(reason)).toBe(expected);
  });
});
