import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  createOrRenewCheckoutSession,
  isCheckoutSessionUsable,
} from "./stripe-checkout-session-lifecycle.js";
import type { IStripePaymentGateway } from "./stripe-payment-gateway.js";

describe("isCheckoutSessionUsable", () => {
  it("returns true for open sessions with a future expiry", () => {
    expect(
      isCheckoutSessionUsable({
        status: "open",
        url: "https://checkout.stripe.com/pay/cs_1",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      } as Stripe.Checkout.Session),
    ).toBe(true);
  });

  it("returns false for expired open sessions", () => {
    expect(
      isCheckoutSessionUsable({
        status: "open",
        url: "https://checkout.stripe.com/pay/cs_1",
        expires_at: Math.floor(Date.now() / 1000) - 60,
      } as Stripe.Checkout.Session),
    ).toBe(false);
  });
});

describe("createOrRenewCheckoutSession", () => {
  it("renews with a new idempotency key when the first session is expired", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        sessionId: "cs_old",
        url: "https://checkout.stripe.com/pay/cs_old",
        paymentIntentId: "pi_old",
      })
      .mockResolvedValueOnce({
        sessionId: "cs_new",
        url: "https://checkout.stripe.com/pay/cs_new",
        paymentIntentId: "pi_new",
      });

    const gateway = {
      retrieveCheckoutSession: vi
        .fn()
        .mockResolvedValueOnce({
          id: "cs_old",
          status: "expired",
          url: "https://checkout.stripe.com/pay/cs_old",
        })
        .mockResolvedValueOnce({
          id: "cs_new",
          status: "open",
          url: "https://checkout.stripe.com/pay/cs_new",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
    } as unknown as IStripePaymentGateway;

    const outcome = await createOrRenewCheckoutSession(gateway, "card", "pay_1", create);

    expect(outcome).toEqual({
      kind: "ready",
      session: {
        sessionId: "cs_new",
        url: "https://checkout.stripe.com/pay/cs_new",
        paymentIntentId: "pi_new",
      },
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toBe("checkout:card:payment:pay_1");
    expect(String(create.mock.calls[1]?.[0])).toMatch(/^checkout:card:payment:pay_1:renewed:/);
  });

  it("returns already_complete when Stripe session is complete", async () => {
    const create = vi.fn().mockResolvedValue({
      sessionId: "cs_done",
      url: "https://checkout.stripe.com/pay/cs_done",
      paymentIntentId: "pi_done",
    });
    const gateway = {
      retrieveCheckoutSession: vi.fn().mockResolvedValue({
        id: "cs_done",
        status: "complete",
        url: "https://checkout.stripe.com/pay/cs_done",
      }),
    } as unknown as IStripePaymentGateway;

    const outcome = await createOrRenewCheckoutSession(gateway, "bank", "pay_2", create);
    expect(outcome).toEqual({ kind: "already_complete" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
