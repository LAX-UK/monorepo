import { describe, expect, it } from "vitest";
import type { PaymentCheckoutContext } from "../interfaces/checkout-rail.js";
import {
  buildCreateCheckoutSessionInput,
  buildStatementDescriptorSuffix,
  buildStripeCheckoutLineItems,
  truncateForStripe,
} from "./stripe-checkout-product-display.js";

const baseCtx: PaymentCheckoutContext = {
  paymentId: "pay-1",
  lot: {
    id: "lot-uuid",
    saleId: null,
    lotNumber: 42,
    title: "Blue Canvas Study",
    description: null,
    medium: "Oil on canvas",
    dimensions: null,
    images: ["uploads/lot.jpg"],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    checkoutPricing: {
      hammerMajor: "100.00",
      premiumMajor: "25.00",
      totalMajor: "125.00",
      policyId: "flat:0.25",
      kind: "flat",
    },
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date(),
    endTime: new Date(),
    status: "ended",
    winnerId: "buyer-1",
    buyerLegalEntityId: "le-buyer",
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
  },
  buyerEmail: "buyer@test.com",
  buyerName: "Buyer",
  amount: "125.00",
  buyerLegalEntityId: "le-buyer",
  amountPence: 12_500,
};

describe("stripe-checkout-product-display", () => {
  it("charges one line at the stored invoice total, whatever the lot's pricing says now", () => {
    const items = buildStripeCheckoutLineItems({
      paymentId: "pay-1",
      lotId: "lot-uuid",
      lotTitle: "Blue Canvas Study",
      lotNumber: 42,
      medium: "Oil on canvas",
      amountCents: 12_500,
      imageUrl: "https://cdn.test/lot.jpg",
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Blue Canvas Study");
    expect(items[0]?.unitAmountCents).toBe(12_500);
    expect(items[0]?.images).toEqual(["https://cdn.test/lot.jpg"]);
  });

  it("the session total equals the invoice amount even after the premium rate changed", () => {
    const input = buildCreateCheckoutSessionInput(
      {
        ...baseCtx,
        // The lot now prices at 20%; the invoice was raised at 25% and is £125.00.
        lot: {
          ...baseCtx.lot,
          checkoutPricing: {
            hammerMajor: "100.00",
            premiumMajor: "20.00",
            totalMajor: "120.00",
            policyId: "flat:0.2",
            kind: "flat",
          },
        },
      },
      { successUrl: "https://app/s", cancelUrl: "https://app/c" },
    );
    const total = input.lineItems.reduce((sum, item) => sum + item.unitAmountCents, 0);
    expect(total).toBe(12_500);
  });

  it("truncates long titles and descriptor suffixes", () => {
    const longTitle = "A".repeat(300);
    expect(truncateForStripe(longTitle, 250).length).toBeLessThanOrEqual(250);
    expect(buildStatementDescriptorSuffix(null, longTitle).length).toBeLessThanOrEqual(22);
    expect(buildStatementDescriptorSuffix(123, "Title")).toBe("LOT 123");
  });

  it("buildCreateCheckoutSessionInput includes custom display fields", () => {
    const input = buildCreateCheckoutSessionInput(baseCtx, {
      successUrl: "https://app/success",
      cancelUrl: "https://app/cancel",
      imageUrl: "https://cdn.test/lot.jpg",
    });

    expect(input.lineItems).toHaveLength(1);
    expect(input.paymentIntentDescription).toContain("Blue Canvas Study");
    expect(input.paymentIntentDescription).toContain("lot 42");
    expect(input.statementDescriptorSuffix).toBe("LOT 42");
    expect(input.buyerEmail).toBe("buyer@test.com");
  });
});
