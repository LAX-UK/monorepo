import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import type { ShopApiError } from "../errors/shop-api-error.js";
import { resolveOrCreateStripeCheckoutSession } from "./shop-checkout-stripe-session.js";

describe("resolveOrCreateStripeCheckoutSession", () => {
  it("expires orphan Stripe sessions when the guarded attach loses the race", async () => {
    const expireHostedCheckout = vi.fn(async () => ({ kind: "expired" as const }));
    const paymentGateway = {
      resolveHostedCheckout: vi.fn(),
      createHostedCheckout: vi.fn(async () => ({
        sessionId: "cs_orphan",
        paymentIntentId: "pi_orphan",
        checkoutUrl: "https://checkout.stripe.test/cs_orphan",
      })),
      expireHostedCheckout,
    };
    const db = {
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [],
          }),
        }),
      }),
    };

    await expect(
      resolveOrCreateStripeCheckoutSession(db as never, paymentGateway as never, {
        orderId: "order-1",
        totalPence: 1000,
        successUrl: "http://localhost:3020/success",
        cancelUrl: "http://localhost:3020/cancel",
        checkoutExpiresAt: new Date(Date.now() + 60_000),
        needsStripeSession: true,
        existingSessionId: null,
        existingCheckoutExpiresAt: null,
        lines: [],
        fulfilmentSurchargePence: 0,
        customerEmail: null,
      }),
    ).rejects.toMatchObject({
      code: SHOP_API_ERROR_CODES.CONFLICT,
    } satisfies Partial<ShopApiError>);

    expect(expireHostedCheckout).toHaveBeenCalledWith({
      orderId: "order-1",
      sessionId: "cs_orphan",
    });
  });
});
