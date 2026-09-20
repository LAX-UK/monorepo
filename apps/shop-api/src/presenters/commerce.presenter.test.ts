import { describe, expect, it } from "vitest";
import type { BasketRecord } from "../application/ports/commerce.ports.js";
import { presentBasket } from "./commerce.presenter.js";

function sampleBasket(overrides: Partial<BasketRecord> = {}): BasketRecord {
  return {
    basketId: "basket-1",
    owner: { kind: "anonymous", tokenHash: "abc" },
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    lines: [
      {
        lineId: "line-1",
        artworkId: "art-1",
        artworkSlug: "warm-basket",
        artworkTitle: "Warm Basket",
        unitPricePence: 12000,
        livePricePence: 12000,
        quantity: 2,
        sellableCount: 5,
      },
    ],
    ...overrides,
  };
}

describe("presentBasket", () => {
  it("computes merchandise subtotal from unit prices and quantities", () => {
    const view = presentBasket(sampleBasket());
    expect(view.merchandiseSubtotalPence).toBe(24000);
    expect(view.lines[0]?.priceChanged).toBe(false);
    expect(view.lines[0]?.outOfStock).toBe(false);
  });

  it("flags price changes and out-of-stock quantities", () => {
    const view = presentBasket(
      sampleBasket({
        lines: [
          {
            lineId: "line-1",
            artworkId: "art-1",
            artworkSlug: "warm-basket",
            artworkTitle: "Warm Basket",
            unitPricePence: 12000,
            livePricePence: 13000,
            quantity: 3,
            sellableCount: 1,
          },
        ],
      }),
    );
    expect(view.lines[0]?.priceChanged).toBe(true);
    expect(view.lines[0]?.outOfStock).toBe(true);
  });
});
