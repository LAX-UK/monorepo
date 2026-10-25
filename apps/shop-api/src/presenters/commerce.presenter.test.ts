import { describe, expect, it } from "vitest";
import type { BasketRecord, OrderRecord } from "../application/ports/commerce.ports.js";
import { presentBasket, presentOrder } from "./commerce.presenter.js";

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
        productVariantId: null,
        productSlug: null,
        productTitle: null,
        variantSku: null,
        unitPricePence: 12000,
        livePricePence: 12000,
        quantity: 2,
        sellableCount: 5,
        imageUrl: "/warm.webp",
        artistName: null,
        artistSlug: null,
        editionSize: null,
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
            productVariantId: null,
            productSlug: null,
            productTitle: null,
            variantSku: null,
            unitPricePence: 12000,
            livePricePence: 13000,
            quantity: 3,
            sellableCount: 1,
            imageUrl: null,
            artistName: null,
            artistSlug: null,
            editionSize: null,
          },
        ],
      }),
    );
    expect(view.lines[0]?.priceChanged).toBe(true);
    expect(view.lines[0]?.outOfStock).toBe(true);
    expect(view.lines[0]?.soldOut).toBe(false);
    expect(view.lines[0]).not.toHaveProperty("sellableCount");
  });

  it("caps an edition line at the per-order limit, lowered to what can be sold", () => {
    const line = sampleBasket().lines[0];
    if (!line) throw new Error("fixture");
    const plenty = presentBasket(sampleBasket({ lines: [{ ...line, sellableCount: 20 }] }));
    expect(plenty.lines[0]?.maxQuantity).toBe(2);
    const one = presentBasket(
      sampleBasket({ lines: [{ ...line, quantity: 1, sellableCount: 1 }] }),
    );
    expect(one.lines[0]?.maxQuantity).toBe(1);
    const none = presentBasket(
      sampleBasket({ lines: [{ ...line, quantity: 1, sellableCount: 0 }] }),
    );
    expect(none.lines[0]?.maxQuantity).toBe(1);
  });

  it("names the artist and the edition size on an edition line", () => {
    const line = sampleBasket().lines[0];
    if (!line) throw new Error("fixture");
    const view = presentBasket(
      sampleBasket({
        lines: [{ ...line, artistName: "Emmett King", artistSlug: "emmett-king", editionSize: 24 }],
      }),
    );
    expect(view.lines[0]).toMatchObject({
      artistName: "Emmett King",
      artistSlug: "emmett-king",
      editionSize: 24,
    });
  });
});

describe("presentOrder", () => {
  const order: OrderRecord = {
    orderId: "550e8400-e29b-41d4-a716-846655440001",
    status: "partially_refunded",
    fulfilment: "uk_insured_delivery",
    merchandiseSubtotalPence: 12000,
    fulfilmentSurchargePence: 0,
    totalPence: 12000,
    refundedPence: 4000,
    lines: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    paidAt: new Date("2026-01-01T00:01:00.000Z"),
    deliveryAddress: null,
  };

  it("passes a refunded status and the refunded amount to the response", () => {
    expect(presentOrder(order)).toMatchObject({
      status: "partially_refunded",
      refundedPence: 4000,
    });
    expect(presentOrder({ ...order, status: "refunded", refundedPence: 12000 })).toMatchObject({
      status: "refunded",
      refundedPence: 12000,
    });
  });

  it("passes each line's artwork image through for order lists", () => {
    const line = {
      orderLineId: "550e8400-e29b-41d4-a716-846655440002",
      artworkSlug: "warm-basket",
      artworkTitle: "Warm Basket",
      productVariantId: null,
      productSlug: null,
      productTitle: null,
      variantSku: null,
      editionNumber: null,
      unitPricePence: 12000,
    };
    const view = presentOrder({
      ...order,
      lines: [
        { ...line, imageUrl: "/warm.webp" },
        { ...line, imageUrl: null },
      ],
    });
    expect(view.lines.map((row) => row.imageUrl)).toEqual(["/warm.webp", null]);
  });
});
