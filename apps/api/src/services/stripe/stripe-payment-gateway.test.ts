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

  it("createCheckoutSession uses idempotency key and payment metadata", async () => {
    const gateway = new StripePaymentGateway({ STRIPE_SECRET_KEY: "sk_test" });
    const sessionsCreate = vi.fn().mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/pay/cs_1",
      payment_intent: "pi_checkout",
    });
    const mockStripe = {
      paymentIntents: { capture: vi.fn(), retrieve: vi.fn() },
      refunds: { create: vi.fn() },
      checkout: { sessions: { create: sessionsCreate } },
      charges: { search: vi.fn() },
    };
    injectStripeClient(gateway, mockStripe as unknown as Stripe);

    const result = await gateway.createCheckoutSession({
      paymentId: "pay_1",
      lotId: "lot_1",
      amountCents: 12500,
      currency: "gbp",
      buyerEmail: "buyer@test.com",
      successUrl: "https://app/success",
      cancelUrl: "https://app/cancel",
    });

    expect(result.url).toContain("checkout.stripe.com");
    expect(result.paymentIntentId).toBe("pi_checkout");
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { paymentId: "pay_1", lotId: "lot_1" },
      }),
      { idempotencyKey: "checkout:payment:pay_1" },
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
});
