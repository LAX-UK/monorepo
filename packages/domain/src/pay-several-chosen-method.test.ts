import { describe, expect, it } from "vitest";
import { payTogether } from "./pay-several-checkout.js";
import { type PaymentTierLimits, paymentMethodsFor } from "./payment-tier-policy.js";

const LIMITS: PaymentTierLimits = {
  minPence: 30,
  cardMaxPence: 500_000,
  manualReviewMinPence: 2_500_000,
  absoluteMaxPence: 10_000_000,
};

describe("payTogether with a chosen method", () => {
  it("takes card up to and including the card limit, and refuses it one penny above", () => {
    expect(payTogether(500_000, LIMITS, false, "card")).toEqual({ allowed: true, rail: "card" });
    expect(payTogether(500_001, LIMITS, false, "card")).toEqual({
      allowed: false,
      reason: "card_over_limit",
    });
  });

  it("takes a bank transfer at any amount an online payment can, including a small one", () => {
    expect(payTogether(30, LIMITS, false, "bank_transfer")).toEqual({
      allowed: true,
      rail: "gb_bank_transfer",
    });
    expect(payTogether(500_000, LIMITS, false, "bank_transfer")).toEqual({
      allowed: true,
      rail: "gb_bank_transfer",
    });
  });

  it("keeps every other limit whichever method was chosen", () => {
    expect(payTogether(29, LIMITS, false, "bank_transfer")).toEqual({
      allowed: false,
      reason: "below_minimum",
    });
    expect(payTogether(2_500_000, LIMITS, false, "bank_transfer")).toEqual({
      allowed: false,
      reason: "needs_finance_review",
    });
    expect(
      payTogether(10_000_001, { ...LIMITS, manualReviewMinPence: 20_000_000 }, false, "card"),
    ).toEqual({ allowed: false, reason: "over_limit" });
    expect(payTogether(100_000, LIMITS, true, "card")).toEqual({
      allowed: false,
      reason: "payer_on_hold",
    });
  });

  it("still lets the amount decide when no method was chosen", () => {
    expect(payTogether(500_001, LIMITS, false)).toEqual({
      allowed: true,
      rail: "gb_bank_transfer",
    });
  });
});

describe("paymentMethodsFor", () => {
  it("offers both while the total is within the card limit", () => {
    expect(paymentMethodsFor(500_000, LIMITS)).toEqual([
      { method: "card", available: true, reason: null },
      { method: "bank_transfer", available: true, reason: null },
    ]);
  });

  it("offers only bank transfer above the card limit, with the reason for card", () => {
    expect(paymentMethodsFor(500_001, LIMITS)).toEqual([
      { method: "card", available: false, reason: "over_card_limit" },
      { method: "bank_transfer", available: true, reason: null },
    ]);
  });

  it("offers neither above what one online payment takes", () => {
    expect(paymentMethodsFor(10_000_001, LIMITS)).toEqual([
      { method: "card", available: false, reason: "over_online_limit" },
      { method: "bank_transfer", available: false, reason: "over_online_limit" },
    ]);
  });
});
