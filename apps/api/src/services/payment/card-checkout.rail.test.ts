import type { IPaymentWriteRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { PaymentCheckoutContext } from "../interfaces/checkout-rail.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import { CardCheckoutRail } from "./card-checkout.rail.js";

const ctx: PaymentCheckoutContext = {
  paymentId: "pay-1",
  lot: {
    id: "lot-1",
    saleId: null,
    lotNumber: 1,
    sellerId: "s1",
    sellerLegalEntityId: "le-seller",
    title: "Test lot",
    description: null,
    medium: null,
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

describe("CardCheckoutRail", () => {
  it("creates card session with line items and no customer_balance", async () => {
    const createCardCheckoutSession = vi.fn().mockResolvedValue({
      sessionId: "cs_1",
      url: "https://checkout.stripe.com/card",
      paymentIntentId: "pi_1",
    });
    const gateway: IStripePaymentGateway = {
      isConfigured: () => true,
      capturePaymentIntent: vi.fn(),
      createRefund: vi.fn(),
      createCardCheckoutSession,
      createBankTransferCheckoutSession: vi.fn(),
      retrievePaymentIntent: vi.fn(),
      retrieveCheckoutSession: vi.fn().mockResolvedValue({
        id: "cs_1",
        status: "open",
        url: "https://checkout.stripe.com/card",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
      findChargeIdForPayment: vi.fn(),
      revokeOpenCheckoutForPayment: vi.fn().mockResolvedValue(undefined),
    };
    const payments = {
      updateStripePaymentIntentId: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPaymentWriteRepository;

    const mediaUrlResolver = {
      resolve: vi.fn().mockResolvedValue("https://cdn.test/lot.jpg"),
      resolveMany: vi.fn(),
    } as unknown as MediaUrlResolver;

    const rail = new CardCheckoutRail(
      { WEB_ORIGIN: "https://app.test" },
      gateway,
      payments,
      mediaUrlResolver,
    );
    const result = await rail.createCheckout(ctx);

    expect(result).toEqual({
      checkoutUrl: "https://checkout.stripe.com/card",
      checkoutRail: "card",
    });
    expect(createCardCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay-1",
        lotId: "lot-1",
        amountCents: 12_500,
        buyerEmail: "buyer@test.com",
        lineItems: expect.arrayContaining([
          expect.objectContaining({ name: expect.stringContaining("Hammer price") }),
          expect.objectContaining({ name: expect.stringContaining("Buyer's premium") }),
        ]),
        paymentIntentDescription: expect.stringContaining("Test lot"),
        statementDescriptorSuffix: "LOT 1",
      }),
    );
    expect(payments.updateStripePaymentIntentId).toHaveBeenCalledWith("pay-1", "pi_1");
  });

  it("returns unavailable when Stripe is not configured", async () => {
    const gateway: IStripePaymentGateway = {
      isConfigured: () => false,
      capturePaymentIntent: vi.fn(),
      createRefund: vi.fn(),
      createCardCheckoutSession: vi.fn(),
      createBankTransferCheckoutSession: vi.fn(),
      retrievePaymentIntent: vi.fn(),
      retrieveCheckoutSession: vi.fn(),
      findChargeIdForPayment: vi.fn(),
      revokeOpenCheckoutForPayment: vi.fn().mockResolvedValue(undefined),
    };
    const rail = new CardCheckoutRail({ WEB_ORIGIN: "https://app.test" }, gateway, {
      updateStripePaymentIntentId: vi.fn(),
    } as unknown as IPaymentWriteRepository);

    const result = await rail.createCheckout(ctx);
    expect(result.checkoutUrl).toBeNull();
    expect(result.errorCode).toBe("stripe_checkout_unavailable");
  });
});
