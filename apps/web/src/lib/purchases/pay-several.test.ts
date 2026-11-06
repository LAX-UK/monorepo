import { describe, expect, it } from "vitest";
import {
  PAY_SEVERAL_BLOCK_COPY,
  PAY_SEVERAL_SKIP_COPY,
  PAY_SEVERAL_START_COPY,
  type PaySeveralPlanView,
  penceOfMajor,
  planChangedNotice,
} from "./pay-several";
import { parsePaySeveralPlan } from "./pay-several-plan";

describe("pay several copy", () => {
  it("says why each left-out invoice is not in the payment", () => {
    expect(PAY_SEVERAL_SKIP_COPY.held_for_review).toBe("Held while we review a payment");
    expect(PAY_SEVERAL_SKIP_COPY.being_paid).toBe("A payment for it is already in progress");
    for (const line of Object.values(PAY_SEVERAL_SKIP_COPY)) expect(line).not.toMatch(/_/);
  });

  it("explains every refusal of the payment in the payer's words, never the code", () => {
    expect(PAY_SEVERAL_START_COPY.pay_several_over_limit).toBe(PAY_SEVERAL_BLOCK_COPY.over_limit);
    for (const line of Object.values(PAY_SEVERAL_START_COPY)) {
      expect(line).not.toMatch(/pay_several|_/);
    }
  });
});

const view = (total: string): PaySeveralPlanView => ({
  payable: [{ lotId: "a", totalDue: total }],
  skipped: [],
  total,
  currency: "GBP",
  block: null,
});

describe("the plan the person was shown", () => {
  it("sends the total as whole pence, exactly", () => {
    expect(penceOfMajor("1000.10")).toBe(100_010);
    expect(penceOfMajor("0.30")).toBe(30);
    expect(penceOfMajor("12")).toBe(1200);
    expect(penceOfMajor("1250.5")).toBe(125_050);
    expect(penceOfMajor("999999.99")).toBe(99_999_999);
  });

  it("refuses anything that is not a pounds amount", () => {
    for (const bad of ["", "abc", "-5.00", "1.234", "0.00", "1,000.00"]) {
      expect(penceOfMajor(bad)).toBeNull();
    }
  });

  it("says the new total when the total changed, and that the invoices changed when it did not", () => {
    expect(planChangedNotice(view("600.10"), view("3100.10"), "£3,100.10")).toBe(
      "The total has changed to £3,100.10. Check it and pay again.",
    );
    expect(planChangedNotice(view("600.10"), view("600.10"), "£600.10")).toBe(
      "The invoices in this payment have changed. Check them and pay again.",
    );
  });

  it("reads the fresh plan the API sends with the change, including why it cannot be paid", () => {
    const plan = parsePaySeveralPlan({
      payable: [{ lotId: "a", totalDue: "5200.10" }],
      skipped: [{ lotId: "b", reason: "held_for_review" }],
      total: "5200.10",
      currency: "GBP",
      payTogether: { allowed: false, reason: "needs_finance_review" },
    });
    expect(plan).toMatchObject({ total: "5200.10", block: "needs_finance_review" });
    expect(parsePaySeveralPlan({ nope: true })).toBeNull();
  });
});
