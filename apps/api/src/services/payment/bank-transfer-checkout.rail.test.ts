import { describe, expect, it, vi } from "vitest";
import type { PaymentCheckoutContext } from "../interfaces/checkout-rail.js";
import type { IPaymentWriteRepository } from "../interfaces/payment-write.js";
import type { IStripeCustomerGateway } from "../interfaces/stripe-customer.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import { BankTransferCheckoutRail } from "./bank-transfer-checkout.rail.js";

const ctx: PaymentCheckoutContext = {
  paymentId: "pay-bank",
  lot: {
    id: "lot-1",
    saleId: null,
    lotNumber: 1,
    sellerId: "s1",
    sellerLegalEntityId: "le-seller",
    title: "High value lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "250000.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "250000.00",
    buyerPremiumRate: "0.25",
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
  amount: "312500.00",
  buyerLegalEntityId: "le-buyer",
  amountPence: 31_250_000,
};

describe("BankTransferCheckoutRail", () => {
  it("requires Stripe customer and creates gb_bank_transfer session", async () => {
    const findOrCreateForLegalEntity = vi.fn().mockResolvedValue("cus_1");
    const createBankTransferCheckoutSession = vi.fn().mockResolvedValue({
      sessionId: "cs_bank",
      url: "https://checkout.stripe.com/bank",
      paymentIntentId: "pi_bank",
    });
    const stripeCustomers: IStripeCustomerGateway = {
      isConfigured: () => true,
      findOrCreateForLegalEntity,
    };
    const gateway: IStripePaymentGateway = {
      isConfigured: () => true,
      capturePaymentIntent: vi.fn(),
      createRefund: vi.fn(),
      createCardCheckoutSession: vi.fn(),
      createBankTransferCheckoutSession,
      retrievePaymentIntent: vi.fn(),
      retrieveCheckoutSession: vi.fn().mockResolvedValue({
        id: "cs_bank",
        status: "open",
        url: "https://checkout.stripe.com/bank",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
      findChargeIdForPayment: vi.fn(),
    };
    const payments = {
      updateStripePaymentIntentId: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPaymentWriteRepository;

    const rail = new BankTransferCheckoutRail(
      { WEB_ORIGIN: "https://app.test" },
      gateway,
      stripeCustomers,
      payments,
    );
    const result = await rail.createCheckout(ctx);

    expect(result).toEqual({
      checkoutUrl: "https://checkout.stripe.com/bank",
      checkoutRail: "gb_bank_transfer",
    });
    expect(findOrCreateForLegalEntity).toHaveBeenCalledWith({
      legalEntityId: "le-buyer",
      buyerEmail: "buyer@test.com",
      buyerName: "Buyer",
    });
    expect(createBankTransferCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay-bank",
        stripeCustomerId: "cus_1",
        lineItems: expect.any(Array),
        paymentIntentDescription: expect.stringContaining("High value lot"),
      }),
    );
  });
});
