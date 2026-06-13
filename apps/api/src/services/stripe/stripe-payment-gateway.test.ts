import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { StripePaymentGateway } from "./stripe-payment-gateway.js";

function injectStripeClient(gateway: StripePaymentGateway, stripe: Stripe) {
  (gateway as unknown as { stripeFactory: IStripeClientFactory }).stripeFactory = {
    get: () => stripe,
    require: () => stripe,
  };
}

describe("StripePaymentGateway", () => {
  it("capture succeeds via retrieve when capture errors with unexpected_state but PI is succeeded", async () => {
    const gateway = new StripePaymentGateway({ STRIPE_SECRET_KEY: "sk_test" });
    const mockStripe = {
      paymentIntents: {
        capture: vi.fn().mockRejectedValue(
          new Stripe.errors.StripeInvalidRequestError({
            message: "cannot capture",
            type: "invalid_request_error",
            code: "payment_intent_unexpected_state",
          } as never),
        ),
        retrieve: vi.fn().mockResolvedValue({
          id: "pi_1",
          object: "payment_intent",
          status: "succeeded",
          latest_charge: "ch_from_retrieve",
        }),
      },
      refunds: { create: vi.fn() },
    };
    injectStripeClient(gateway, mockStripe as unknown as Stripe);

    const pi = await gateway.capturePaymentIntent("pi_1");
    expect(pi.status).toBe("succeeded");
    expect(pi.latest_charge).toBe("ch_from_retrieve");
    expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith("pi_1");
  });

  it("createCardCheckoutSession uses idempotency key and lot display fields", async () => {
    const gateway = new StripePaymentGateway({ STRIPE_SECRET_KEY: "sk_test" });
    const sessionsCreate = vi.fn().mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/pay/cs_1",
      payment_intent: "pi_checkout",
    });
    const mockStripe = {
      paymentIntents: { capture: vi.fn(), retrieve: vi.fn() },
      refunds: { create: vi.fn() },
      checkout: { sessions: { create: sessionsCreate, retrieve: vi.fn() } },
      charges: { search: vi.fn() },
    };
    injectStripeClient(gateway, mockStripe as unknown as Stripe);

    const result = await gateway.createCardCheckoutSession({
      paymentId: "pay_1",
      lotId: "lot_1",
      amountCents: 12500,
      currency: "gbp",
      buyerEmail: "buyer@test.com",
      successUrl: "https://app/success",
      cancelUrl: "https://app/cancel",
      lineItems: [
        {
          name: "Hammer price — Blue Study",
          description: "Lot 42 · LAX auction settlement",
          unitAmountCents: 10000,
          images: ["https://cdn.test/lot.jpg"],
        },
        {
          name: "Buyer's premium (25%)",
          unitAmountCents: 2500,
        },
      ],
      paymentIntentDescription: "Auction settlement — Blue Study (lot 42)",
      statementDescriptorSuffix: "LOT 42",
    });

    expect(result.url).toContain("checkout.stripe.com");
    expect(result.paymentIntentId).toBe("pi_checkout");
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en-GB",
        metadata: expect.objectContaining({
          paymentId: "pay_1",
          lotId: "lot_1",
          checkoutRail: "card",
        }),
        custom_text: expect.objectContaining({
          submit: expect.objectContaining({ message: expect.stringContaining("LAX") }),
        }),
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 10000,
              product_data: expect.objectContaining({
                name: "Hammer price — Blue Study",
                images: ["https://cdn.test/lot.jpg"],
              }),
            }),
          }),
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 2500,
              product_data: expect.objectContaining({ name: "Buyer's premium (25%)" }),
            }),
          }),
        ],
        payment_intent_data: expect.objectContaining({
          description: "Auction settlement — Blue Study (lot 42)",
          statement_descriptor_suffix: "LOT 42",
          receipt_email: "buyer@test.com",
        }),
      }),
      { idempotencyKey: "checkout:card:payment:pay_1" },
    );
  });

  it("createBankTransferCheckoutSession uses gb_bank_transfer and separate idempotency key", async () => {
    const gateway = new StripePaymentGateway({ STRIPE_SECRET_KEY: "sk_test" });
    const sessionsCreate = vi.fn().mockResolvedValue({
      id: "cs_bank",
      url: "https://checkout.stripe.com/pay/cs_bank",
      payment_intent: "pi_bank",
    });
    const mockStripe = {
      paymentIntents: { capture: vi.fn(), retrieve: vi.fn() },
      refunds: { create: vi.fn() },
      checkout: { sessions: { create: sessionsCreate, retrieve: vi.fn() } },
      charges: { search: vi.fn() },
    };
    injectStripeClient(gateway, mockStripe as unknown as Stripe);

    await gateway.createBankTransferCheckoutSession({
      paymentId: "pay_2",
      lotId: "lot_2",
      amountCents: 25000000,
      currency: "gbp",
      buyerEmail: "buyer@test.com",
      successUrl: "https://app/success",
      cancelUrl: "https://app/cancel",
      stripeCustomerId: "cus_1",
      lineItems: [
        {
          name: "High value lot",
          unitAmountCents: 25000000,
        },
      ],
      paymentIntentDescription: "Auction settlement — High value lot (lot 2)",
      statementDescriptorSuffix: "LOT 2",
    });

    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_1",
        payment_method_types: ["customer_balance"],
        payment_method_options: {
          customer_balance: {
            funding_type: "bank_transfer",
            bank_transfer: { type: "gb_bank_transfer" },
          },
        },
      }),
      { idempotencyKey: "checkout:bank:payment:pay_2" },
    );
  });

  it("createRefund maps charge_already_refunded to already_refunded result", async () => {
    const gateway = new StripePaymentGateway({ STRIPE_SECRET_KEY: "sk_test" });
    const mockStripe = {
      paymentIntents: { capture: vi.fn(), retrieve: vi.fn() },
      refunds: {
        create: vi.fn().mockRejectedValue(
          new Stripe.errors.StripeInvalidRequestError({
            message: "already refunded",
            type: "invalid_request_error",
            code: "charge_already_refunded",
          } as never),
        ),
      },
    };
    injectStripeClient(gateway, mockStripe as unknown as Stripe);

    const r = await gateway.createRefund({ chargeId: "ch_1", amount: 100 });
    expect(r).toEqual({ kind: "already_refunded" });
  });

  it("createRefund passes idempotency key", async () => {
    const gateway = new StripePaymentGateway({ STRIPE_SECRET_KEY: "sk_test" });
    const refundsCreate = vi.fn().mockResolvedValue({ id: "re_1" });
    const mockStripe = {
      paymentIntents: { capture: vi.fn(), retrieve: vi.fn() },
      refunds: { create: refundsCreate },
    };
    injectStripeClient(gateway, mockStripe as unknown as Stripe);

    await gateway.createRefund({ chargeId: "ch_1", amount: 100 });

    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ charge: "ch_1", amount: 100 }),
      { idempotencyKey: "refund:ch_1:100" },
    );
  });

  it("revokeOpenCheckoutForPayment expires open sessions and cancels the payment intent", async () => {
    const gateway = new StripePaymentGateway({ STRIPE_SECRET_KEY: "sk_test" });
    const sessionsExpire = vi.fn().mockResolvedValue({ id: "cs_1", status: "expired" });
    const sessionsList = vi.fn().mockResolvedValue({
      data: [{ id: "cs_1", status: "open" }],
    });
    const paymentIntentsCancel = vi.fn().mockResolvedValue({ id: "pi_1", status: "canceled" });
    const mockStripe = {
      paymentIntents: {
        capture: vi.fn(),
        retrieve: vi.fn(),
        cancel: paymentIntentsCancel,
        search: vi.fn(),
      },
      refunds: { create: vi.fn() },
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn(),
          list: sessionsList,
          expire: sessionsExpire,
        },
      },
      charges: { search: vi.fn() },
    };
    injectStripeClient(gateway, mockStripe as unknown as Stripe);

    await gateway.revokeOpenCheckoutForPayment("pay_1", "pi_1");

    expect(sessionsList).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 10 });
    expect(sessionsExpire).toHaveBeenCalledWith("cs_1");
    expect(paymentIntentsCancel).toHaveBeenCalledWith(
      "pi_1",
      {},
      { idempotencyKey: "cancel:pi_1" },
    );
  });
});
