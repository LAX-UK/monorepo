import { describe, expect, it } from "vitest";
import { payTogether } from "./pay-several-checkout.js";
import type { PaymentTierLimits } from "./payment-tier-policy.js";

const LIMITS: PaymentTierLimits = {
  minPence: 30,
  cardMaxPence: 500_000,
  manualReviewMinPence: 2_500_000,
  absoluteMaxPence: 10_000_000,
};

describe("payTogether", () => {
  it("takes the total by card up to the card limit", () => {
    expect(payTogether(500_000, LIMITS, false)).toEqual({ allowed: true, rail: "card" });
  });

  it("moves a total over the card limit to bank transfer, even when each invoice is under it", () => {
    // Two invoices of £3,000 each: each alone is a card payment; together they are £6,000.
    expect(payTogether(300_000 + 300_000, LIMITS, false)).toEqual({
      allowed: true,
      rail: "gb_bank_transfer",
    });
  });

  it("refuses a total that would need a finance review, so a batch never slips under it", () => {
    expect(payTogether(2_500_000, LIMITS, false)).toEqual({
      allowed: false,
      reason: "needs_finance_review",
    });
    expect(payTogether(2_499_999, LIMITS, false)).toEqual({
      allowed: true,
      rail: "gb_bank_transfer",
    });
  });

  it("refuses a total over the online limit or under the minimum", () => {
    const highReview = { ...LIMITS, manualReviewMinPence: 20_000_000 };
    expect(payTogether(10_000_001, highReview, false)).toEqual({
      allowed: false,
      reason: "over_limit",
    });
    expect(payTogether(29, LIMITS, false)).toEqual({ allowed: false, reason: "below_minimum" });
  });

  it("refuses everything while the payer has a compliance check open", () => {
    expect(payTogether(1_000, LIMITS, true)).toEqual({ allowed: false, reason: "payer_on_hold" });
  });
});
