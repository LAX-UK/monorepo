import { describe, expect, it, vi } from "vitest";
import type { CommerceRepository } from "../ports/commerce.ports.js";
import { createCheckoutOrderHandler, createGetBasketHandler } from "./commerce-handlers.js";

describe("commerce handlers", () => {
  it("delegates basket reads to the repository port", async () => {
    const getBasket = vi.fn(async () => null);
    const handler = createGetBasketHandler({ getBasket } as unknown as CommerceRepository);
    await handler({ kind: "anonymous", tokenHash: "abc" });
    expect(getBasket).toHaveBeenCalledWith({ kind: "anonymous", tokenHash: "abc" });
  });

  it("delegates checkout to the repository port", async () => {
    const createCheckoutOrder = vi.fn(async () => ({
      orderId: "order-1",
      checkoutUrl: "https://example.test/checkout",
      expiresAt: new Date(),
    }));
    const handler = createCheckoutOrderHandler({
      createCheckoutOrder,
    } as unknown as CommerceRepository);
    const input = {
      subject: "sub-1",
      basketId: "basket-1",
      fulfilment: "uk_insured_delivery" as const,
      idempotencyKey: "key-1",
      successUrl: "https://shop.test/success",
      cancelUrl: "https://shop.test/cancel",
    };
    await handler(input);
    expect(createCheckoutOrder).toHaveBeenCalledWith(input);
  });
});
