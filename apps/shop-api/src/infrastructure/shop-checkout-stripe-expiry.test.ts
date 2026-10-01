import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import type { PaymentCheckoutGateway } from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  assertCheckoutNotAlreadyPaid,
  assertCheckoutNotAsyncPending,
  expireHostedCheckoutSession,
  isAsyncCheckoutPaymentPending,
} from "./shop-checkout-stripe-expiry.js";

describe("shop checkout stripe expiry", () => {
  it("returns async_pending from the gateway without expiring", async () => {
    const gateway: PaymentCheckoutGateway = {
      createHostedCheckout: vi.fn(),
      resolveHostedCheckout: vi.fn(),
      expireHostedCheckout: vi.fn(async () => ({ kind: "async_pending" as const })),
    };
    await expect(
      expireHostedCheckoutSession(gateway, { orderId: "order-1", sessionId: "cs_test" }),
    ).resolves.toEqual({ kind: "async_pending" });
  });

  it("throws when buyer cancels while async payment is pending", () => {
    expect(() => assertCheckoutNotAsyncPending({ kind: "async_pending" })).toThrow(ShopApiError);
    try {
      assertCheckoutNotAsyncPending({ kind: "async_pending" });
    } catch (err) {
      expect(err).toMatchObject({
        code: SHOP_API_ERROR_CODES.CONFLICT,
        message: "Payment in progress",
        statusCode: 409,
      });
    }
  });

  it("detects async pending for reaper skip", () => {
    expect(isAsyncCheckoutPaymentPending({ kind: "async_pending" })).toBe(true);
    expect(isAsyncCheckoutPaymentPending({ kind: "expired" })).toBe(false);
  });

  it("still rejects already paid checkout on cancel", () => {
    expect(() => assertCheckoutNotAlreadyPaid({ kind: "already_complete" })).toThrow(
      /Payment already completed/,
    );
  });
});
