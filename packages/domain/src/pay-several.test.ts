import { describe, expect, it } from "vitest";
import {
  PAY_SEVERAL_MAX_INVOICES,
  type PaySeveralCandidate,
  planPaySeveral,
} from "./pay-several.js";

const ACCOUNT = "acct-1";
const pick = (lotId: string, over: Partial<PaySeveralCandidate> = {}): PaySeveralCandidate => ({
  lotId,
  buyerAccountId: ACCOUNT,
  invoice: "due",
  payerMayPay: true,
  totalDue: "1000.00",
  currency: "GBP",
  ...over,
});

describe("planPaySeveral", () => {
  it("sums the payable invoices exactly", () => {
    const decision = planPaySeveral(ACCOUNT, [
      pick("a", { totalDue: "1200.10" }),
      pick("b", { totalDue: "0.20", invoice: "overdue" }),
      pick("c", { totalDue: "99.70" }),
    ]);
    expect(decision).toEqual({
      allowed: true,
      plan: expect.objectContaining({ currency: "GBP", total: "1300.00", skipped: [] }),
    });
  });

  it("skips what cannot be paid, saying why, and pays the rest", () => {
    const decision = planPaySeveral(ACCOUNT, [
      pick("a"),
      pick("b", { buyerAccountId: "acct-2" }),
      pick("c", { invoice: "paid" }),
      pick("d", { payerMayPay: false }),
      pick("e", { invoice: "not_invoiced", totalDue: null }),
    ]);
    if (!decision.allowed) throw new Error("expected a plan");
    expect(decision.plan.payable.map((p) => p.lotId)).toEqual(["a"]);
    expect(decision.plan.skipped).toEqual([
      { lotId: "b", reason: "other_account" },
      { lotId: "c", reason: "not_owed" },
      { lotId: "d", reason: "not_payer" },
      { lotId: "e", reason: "not_invoiced" },
    ]);
    expect(decision.plan.total).toBe("1000.00");
  });

  it("refuses an empty, oversized or duplicated batch", () => {
    expect(planPaySeveral(ACCOUNT, [])).toEqual({ allowed: false, reason: "pay_several_empty" });
    const many = Array.from({ length: PAY_SEVERAL_MAX_INVOICES + 1 }, (_, i) => pick(`l${i}`));
    expect(planPaySeveral(ACCOUNT, many)).toEqual({
      allowed: false,
      reason: "pay_several_too_many",
    });
    expect(planPaySeveral(ACCOUNT, [pick("a"), pick("a")])).toEqual({
      allowed: false,
      reason: "pay_several_duplicate",
    });
  });

  it("refuses when nothing is left to pay", () => {
    expect(planPaySeveral(ACCOUNT, [pick("a", { invoice: "processing" })])).toEqual({
      allowed: false,
      reason: "pay_several_nothing_payable",
    });
  });

  it("refuses one payment across currencies", () => {
    expect(planPaySeveral(ACCOUNT, [pick("a"), pick("b", { currency: "EUR" })])).toEqual({
      allowed: false,
      reason: "pay_several_mixed_currency",
    });
  });
});
