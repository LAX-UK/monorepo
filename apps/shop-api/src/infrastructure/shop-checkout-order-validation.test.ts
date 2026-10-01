import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { assertReplayableCheckoutOrder } from "./shop-checkout-order-validation.js";

describe("assertReplayableCheckoutOrder", () => {
  const base = {
    id: "order-1",
    identitySubjectId: "sub-1",
    fulfilment: "uk_insured_delivery" as const,
    status: "pending_payment",
    checkoutExpiresAt: new Date(Date.now() + 60_000),
    stripeCheckoutSessionId: "cs_test",
    totalPence: 1000,
  };

  it("accepts a replayable pending order", () => {
    expect(() =>
      assertReplayableCheckoutOrder(base, {
        subject: "sub-1",
        fulfilment: "uk_insured_delivery",
      }),
    ).not.toThrow();
  });

  it("rejects expired checkout windows", () => {
    expect(() =>
      assertReplayableCheckoutOrder(
        { ...base, checkoutExpiresAt: new Date(Date.now() - 1_000) },
        { subject: "sub-1", fulfilment: "uk_insured_delivery" },
      ),
    ).toThrow(expect.objectContaining({ code: SHOP_API_ERROR_CODES.CONFLICT }));
  });
});
