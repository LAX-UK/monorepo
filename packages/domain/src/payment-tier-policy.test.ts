import { describe, expect, it } from "vitest";
import {
  parsePaymentTierLimits,
  resolveCheckoutRail,
  resolveManualReviewReason,
} from "./payment-tier-policy.js";

const defaultLimits = parsePaymentTierLimits({
  STRIPE_CARD_CHECKOUT_MAX: 100_000,
  STRIPE_MANUAL_REVIEW_MIN: 500_000,
  STRIPE_ABSOLUTE_MAX: 999_999.99,
});

describe("payment tier policy", () => {
  it("parses default env limits to expected pence", () => {
    expect(defaultLimits.cardMaxPence).toBe(10_000_000);
    expect(defaultLimits.manualReviewMinPence).toBe(50_000_000);
    expect(defaultLimits.absoluteMaxPence).toBe(99_999_999);
  });

  it("card at £100,000.00 inclusive", () => {
    expect(resolveCheckoutRail(10_000_000, defaultLimits)).toBe("card");
  });

  it("bank transfer above card max", () => {
    expect(resolveCheckoutRail(10_000_001, defaultLimits)).toBe("gb_bank_transfer");
  });

  it("manual review reason at high value", () => {
    expect(resolveManualReviewReason(50_000_000, defaultLimits, false)).toBe("high_value");
  });

  it("blocked above absolute max", () => {
    expect(resolveCheckoutRail(100_000_000, defaultLimits)).toBeNull();
  });

  it("seller archived manual review reason", () => {
    expect(resolveManualReviewReason(5_000_000, defaultLimits, true)).toBe("seller_archived");
  });
});
