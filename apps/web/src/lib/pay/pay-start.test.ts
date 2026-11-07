import { describe, expect, it, vi } from "vitest";
import { LOT_A, LOT_B, payable, planOf } from "./pay-plan-fixtures.test-util";
import { payStartResult, planChangedMessage } from "./pay-start";

const unread = async () => null;

describe("planChangedMessage", () => {
  it("names the new total, from the plan read again", () => {
    const now = planOf([payable(LOT_A, 100_000, 25_000), payable(LOT_B, 200_000, 50_000)]);
    expect(planChangedMessage(125_000, now)).toBe(
      "The total has changed to £3,750.00. Check it and pay again.",
    );
  });

  it("says the invoices changed when the total did not", () => {
    const now = planOf([payable(LOT_A, 100_000, 25_000)]);
    expect(planChangedMessage(125_000, now)).toBe(
      "The invoices in this payment have changed. Check them and pay again.",
    );
  });

  it("never invents a figure when the plan cannot be read again", () => {
    expect(planChangedMessage(125_000, null)).toBe(
      "The total has changed. Check it and pay again.",
    );
  });
});

describe("payStartResult", () => {
  it("goes to the payment page the server opened", async () => {
    const result = await payStartResult(
      { status: 200, body: { data: { checkoutUrl: "https://checkout.stripe.com/c/pay_1" } } },
      125_000,
      unread,
    );
    expect(result).toEqual({ kind: "redirect", url: "https://checkout.stripe.com/c/pay_1" });
  });

  it("does not go anywhere when the answer holds no payment page", async () => {
    const result = await payStartResult({ status: 200, body: { data: {} } }, 125_000, unread);
    expect(result).toMatchObject({ kind: "failed", refresh: false });
  });

  it("answers a changed plan with the new total and charges nothing", async () => {
    const planNow = vi.fn(async () => planOf([payable(LOT_A, 100_000, 50_000)]));
    const result = await payStartResult(
      { status: 409, body: { error: "pay_plan_changed", plan: { total: "1500.00" } } },
      125_000,
      planNow,
    );
    expect(planNow).toHaveBeenCalledOnce();
    expect(result).toEqual({
      kind: "changed",
      message: "The total has changed to £1,500.00. Check it and pay again.",
    });
  });

  it("treats a request the server never saw a plan for the same way", async () => {
    const result = await payStartResult(
      { status: 409, body: { error: "pay_plan_changed" } },
      125_000,
      async () => planOf([payable(LOT_A, 100_000, 25_000)]),
    );
    expect(result.kind).toBe("changed");
  });

  it("reads a held payer from the server and asks for the page to be read again", async () => {
    const result = await payStartResult(
      { status: 403, body: { error: "pay_several_payer_on_hold" } },
      125_000,
      unread,
    );
    expect(result).toMatchObject({ kind: "failed", refresh: true });
    expect(result.kind === "failed" ? result.message : "").toMatch(/checking a few details/);
  });

  it("explains every refusal in the payer's words, never the code", async () => {
    const codes = [
      "pay_several_payer_on_hold",
      "pay_several_winner_on_hold",
      "pay_several_below_minimum",
      "pay_several_over_limit",
      "pay_several_needs_finance_review",
      "pay_several_nothing_payable",
      "pay_several_mixed_currency",
      "pay_several_conflict",
      "pay_several_unavailable",
      "onboarding_required",
      "insufficient_entity_role",
      "account_suspended",
      "bidding_not_allowed_for_role",
    ];
    for (const error of codes) {
      const result = await payStartResult({ status: 403, body: { error } }, 125_000, unread);
      expect(result.kind, error).toBe("failed");
      const message = result.kind === "failed" ? result.message : "";
      expect(message, error).not.toMatch(/pay_several|_/);
      expect(message.length, error).toBeGreaterThan(10);
    }
  });

  it("says nothing was charged when it fails for a reason we do not know", async () => {
    const result = await payStartResult({ status: 500, body: null }, 125_000, unread);
    expect(result).toEqual({
      kind: "failed",
      message: "We couldn't open the secure payment page. Nothing was charged.",
      refresh: false,
    });
  });
});
