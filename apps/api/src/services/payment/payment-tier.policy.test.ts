import { describe, expect, it } from "vitest";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import {
  PaymentTierPolicy,
  parsePaymentTierLimits,
  resolveCheckoutRail,
  resolveManualReviewReason,
} from "./payment-tier.policy.js";

const defaultLimits = parsePaymentTierLimits({
  STRIPE_CARD_CHECKOUT_MAX: 100_000,
  STRIPE_MANUAL_REVIEW_MIN: 500_000,
  STRIPE_ABSOLUTE_MAX: 999_999.99,
});

describe("PaymentTierPolicy", () => {
  it("parses default env limits to expected pence", () => {
    expect(defaultLimits.cardMaxPence).toBe(10_000_000);
    expect(defaultLimits.manualReviewMinPence).toBe(50_000_000);
    expect(defaultLimits.absoluteMaxPence).toBe(99_999_999);
    expect(gbpAmountToPence("999999.99")).toBe(99_999_999);
  });

  it("card at £100,000.00 inclusive", () => {
    expect(resolveCheckoutRail(gbpAmountToPence("100000.00"), defaultLimits)).toBe("card");
  });

  it("bank transfer at £100,000.01", () => {
    expect(resolveCheckoutRail(gbpAmountToPence("100000.01"), defaultLimits)).toBe(
      "gb_bank_transfer",
    );
  });

  it("bank transfer at £499,999.99", () => {
    expect(resolveCheckoutRail(gbpAmountToPence("499999.99"), defaultLimits)).toBe(
      "gb_bank_transfer",
    );
  });

  it("manual review reason at £500,000.00", () => {
    expect(resolveManualReviewReason(gbpAmountToPence("500000.00"), defaultLimits, false)).toBe(
      "high_value",
    );
  });

  it("manual review gate does not block checkout rail after release", () => {
    const pence = gbpAmountToPence("600000.00");
    const policy = new PaymentTierPolicy(defaultLimits);
    expect(policy.needsManualReviewGate(pence, false)).toBe(true);
    expect(policy.resolveCheckoutRail(pence)).toBe("gb_bank_transfer");
  });

  it("blocked above £999,999.99", () => {
    expect(resolveCheckoutRail(gbpAmountToPence("1000000.00"), defaultLimits)).toBeNull();
    expect(
      new PaymentTierPolicy(defaultLimits).validateCheckoutAmountPence(
        gbpAmountToPence("1000000.00"),
      ),
    ).toBe("blocked");
  });

  it("invalid below minimum", () => {
    expect(resolveCheckoutRail(29, defaultLimits)).toBeNull();
  });

  it("seller archived manual review reason", () => {
    expect(resolveManualReviewReason(gbpAmountToPence("50000.00"), defaultLimits, true)).toBe(
      "seller_archived",
    );
  });

  it("combined manual review reason", () => {
    expect(resolveManualReviewReason(gbpAmountToPence("600000.00"), defaultLimits, true)).toBe(
      "seller_archived_and_high_value",
    );
  });

  it("card one pence below bank-transfer boundary stays card", () => {
    expect(resolveCheckoutRail(10_000_000 - 1, defaultLimits)).toBe("card");
  });

  it("bank transfer one pence above card max", () => {
    expect(resolveCheckoutRail(10_000_000 + 1, defaultLimits)).toBe("gb_bank_transfer");
  });

  it("bank transfer one pence below manual review min", () => {
    expect(resolveCheckoutRail(50_000_000 - 1, defaultLimits)).toBe("gb_bank_transfer");
  });

  it("manual review at £999,999.99 is allowed for checkout rail after release", () => {
    expect(resolveCheckoutRail(gbpAmountToPence("999999.99"), defaultLimits)).toBe(
      "gb_bank_transfer",
    );
  });
});
