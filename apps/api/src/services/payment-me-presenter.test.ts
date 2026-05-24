import { describe, expect, it } from "vitest";
import { gbpAmountToPence } from "../lib/decimal-money.js";
import type { PaymentRecord } from "./interfaces/payment-write.js";
import { presentMyPayments } from "./payment-me-presenter.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "./payment/payment-tier.policy.js";

describe("presentMyPayments", () => {
  const policy = new PaymentTierPolicy(
    parsePaymentTierLimits({
      STRIPE_CARD_CHECKOUT_MAX: 100_000,
      STRIPE_MANUAL_REVIEW_MIN: 500_000,
      STRIPE_ABSOLUTE_MAX: 999_999.99,
    }),
  );

  const row: PaymentRecord = {
    id: "pay-1",
    lotId: "lot-1",
    buyerId: "buyer-1",
    amount: "125.00",
    platformFee: "6.25",
    sellerLegalEntityId: "le-seller",
    stripePaymentIntentId: null,
    stripeChargeId: null,
    stripeRefundId: null,
    status: "pending",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("includes checkoutRail for pending card-tier amounts", async () => {
    const out = await presentMyPayments(
      [row],
      new Map([
        [
          "lot-1",
          {
            id: "lot-1",
            title: "Blue Study",
            images: [],
          } as never,
        ],
      ]),
      undefined,
      { paymentTierPolicy: policy },
    );
    expect(out[0]?.checkoutRail).toBe("card");
    expect(out[0]?.manualReviewReason).toBeNull();
  });

  it("includes manualReviewReason for requires_manual_review rows", async () => {
    const reviewRow: PaymentRecord = {
      ...row,
      amount: "600000.00",
      status: "requires_manual_review",
    };
    const out = await presentMyPayments(
      [reviewRow],
      new Map([["lot-1", { id: "lot-1", title: "Lot", images: [] } as never]]),
      undefined,
      {
        paymentTierPolicy: policy,
        sellerArchivedByEntityId: new Map([["le-seller", false]]),
      },
    );
    expect(out[0]?.checkoutRail).toBeNull();
    expect(out[0]?.manualReviewReason).toBe("high_value");
    expect(gbpAmountToPence(reviewRow.amount)).toBeGreaterThanOrEqual(50_000_000);
  });
});
