import { canProceedToCheckout } from "@/lib/basket-checkout-eligibility";
import type { BasketView } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";

const baseBasket: BasketView = {
  basketId: "b1",
  lines: [
    {
      lineId: "l1",
      artworkSlug: "a",
      artworkTitle: "A",
      quantity: 1,
      unitPricePence: 1000,
      sellableCount: 1,
      priceChanged: false,
      outOfStock: false,
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
