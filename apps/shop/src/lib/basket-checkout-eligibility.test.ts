import {
  basketCheckoutEntry,
  basketKnownEmpty,
  canProceedToCheckout,
} from "@/lib/basket-checkout-eligibility";
import type { BasketView } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";

const baseBasket: BasketView = {
  basketId: "b1",
  lines: [
    {
      lineId: "l1",
      artworkSlug: "a",
      artworkTitle: "A",
      productVariantId: null,
      productSlug: null,
      productTitle: null,
      variantSku: null,
      quantity: 1,
      unitPricePence: 1000,
      soldOut: false,
      priceChanged: false,
      outOfStock: false,
      imageUrl: null,
    },
  ],
  merchandiseSubtotalPence: 1000,
  expiresAt: "2026-01-01T00:00:00.000Z",
};

describe("canProceedToCheckout", () => {
  it("blocks when lines are stale", () => {
    const line = baseBasket.lines[0];
    if (!line) throw new Error("fixture line missing");
    expect(
      canProceedToCheckout({
        ...baseBasket,
        lines: [{ ...line, priceChanged: true }],
      }),
    ).toBe(false);
  });

  it("allows a clean basket", () => {
    expect(canProceedToCheckout(baseBasket)).toBe(true);
  });
});

describe("basketKnownEmpty", () => {
  it("treats a missing basket and a basket without lines as empty", () => {
    expect(basketKnownEmpty({ status: "empty" })).toBe(true);
    expect(basketKnownEmpty({ status: "ok", data: { ...baseBasket, lines: [] } })).toBe(true);
  });

  it("does not treat lines, failures or 401s as empty", () => {
    expect(basketKnownEmpty({ status: "ok", data: baseBasket })).toBe(false);
    expect(basketKnownEmpty({ status: "failed" })).toBe(false);
    expect(basketKnownEmpty({ status: "unauthorized" })).toBe(false);
  });
});

describe("basketCheckoutEntry", () => {
  it("sends signed-out shoppers to checkout, where guest checkout is offered", () => {
    expect(basketCheckoutEntry("guest")).toBe("checkout");
    expect(basketCheckoutEntry("authenticated")).toBe("checkout");
  });

  it("asks for sign-in only when the session cannot be used", () => {
    expect(basketCheckoutEntry("unavailable")).toBe("sign_in");
    expect(basketCheckoutEntry("disabled")).toBe("sign_in");
  });
});
