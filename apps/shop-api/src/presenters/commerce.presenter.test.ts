import { describe, expect, it } from "vitest";
import type { BasketRecord, OrderRecord } from "../application/ports/commerce.ports.js";
import { sampleOrderLine, sampleOrderRecord } from "../test-support/order-record.fixture.js";
import { presentBasket, presentOrder } from "./commerce.presenter.js";

const LIMIT = { editionOrderLimit: 2 };

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
    const view = presentBasket(sampleBasket(), LIMIT);
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
      LIMIT,
    );
    expect(view.lines[0]?.priceChanged).toBe(true);
    expect(view.lines[0]?.outOfStock).toBe(true);
    expect(view.lines[0]?.soldOut).toBe(false);
    expect(view.lines[0]).not.toHaveProperty("sellableCount");
  });

  it("caps an edition line at the per-order limit, lowered to what can be sold", () => {
    const line = sampleBasket().lines[0];
    if (!line) throw new Error("fixture");
    const plenty = presentBasket(sampleBasket({ lines: [{ ...line, sellableCount: 20 }] }), LIMIT);
    expect(plenty.lines[0]?.maxQuantity).toBe(2);
    const one = presentBasket(
      sampleBasket({ lines: [{ ...line, quantity: 1, sellableCount: 1 }] }),
      LIMIT,
    );
    expect(one.lines[0]?.maxQuantity).toBe(1);
    const none = presentBasket(
      sampleBasket({ lines: [{ ...line, quantity: 1, sellableCount: 0 }] }),
      LIMIT,
    );
    expect(none.lines[0]?.maxQuantity).toBe(1);
    expect(plenty.lines[0]?.orderLimit).toBe(2);
  });

  it("leaves only the stock as the ceiling when no order limit is set", () => {
    const line = sampleBasket().lines[0];
    if (!line) throw new Error("fixture");
    const view = presentBasket(sampleBasket({ lines: [{ ...line, sellableCount: 5 }] }), {
      editionOrderLimit: null,
    });
    expect(view.lines[0]?.orderLimit).toBeNull();
    expect(view.lines[0]?.maxQuantity).toBe(5);
  });

  it("sums line totals, quantity included, for the subtotal", () => {
    const line = sampleBasket().lines[0];
    if (!line) throw new Error("fixture");
    const view = presentBasket(
      sampleBasket({
        lines: [
          { ...line, quantity: 2, unitPricePence: 12000 },
          { ...line, lineId: "line-2", quantity: 1, unitPricePence: 8500 },
        ],
      }),
      LIMIT,
    );
    expect(view.merchandiseSubtotalPence).toBe(32500);
  });

  it("names the artist and the edition size on an edition line", () => {
    const line = sampleBasket().lines[0];
    if (!line) throw new Error("fixture");
    const view = presentBasket(
      sampleBasket({
        lines: [{ ...line, artistName: "Emmett King", artistSlug: "emmett-king", editionSize: 24 }],
      }),
      LIMIT,
    );
    expect(view.lines[0]).toMatchObject({
      artistName: "Emmett King",
      artistSlug: "emmett-king",
      editionSize: 24,
    });
  });
});

describe("presentOrder", () => {
  const order: OrderRecord = sampleOrderRecord({
    status: "partially_refunded",
    fulfilmentSurchargePence: 0,
    totalPence: 12000,
    refundedPence: 4000,
    lines: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    paidAt: new Date("2026-01-01T00:01:00.000Z"),
    deliveryAddress: null,
  });

  it("gives the reference, the VAT included and the tracking link", () => {
    const view = presentOrder(
      sampleOrderRecord({
        progress: {
          status: "in_transit",
          carrier: "Royal Mail",
          trackingNumber: "AB123456789GB",
          productionStartedAt: new Date("2026-10-02T09:00:00.000Z"),
          dispatchedAt: new Date("2026-10-03T09:00:00.000Z"),
          readyForCollectionAt: null,
          possessionAt: null,
          cancelledAt: null,
        },
      }),
      new Date("2026-10-04T09:00:00.000Z"),
    );
    expect(view).toMatchObject({
      reference: "LAX-S-10482",
      vatIncludedPence: 2250,
      vatRateBp: 2000,
      invoiceAvailable: true,
      problemReport: { open: true, endsAt: null },
      progress: {
        trackingUrl: "https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB",
        dispatchedAt: "2026-10-03T09:00:00.000Z",
      },
    });
  });

  it("offers no VAT figure, invoice or problem report where the data does not support one", () => {
    const view = presentOrder(
      sampleOrderRecord({
        status: "expired",
        paidAt: null,
        checkoutExpiresAt: new Date("2026-10-01T09:30:00.000Z"),
        lines: [sampleOrderLine({ vatRateBp: null })],
      }),
    );
    expect(view).toMatchObject({
      vatIncludedPence: null,
      invoiceAvailable: false,
      problemReport: { open: false },
      // Only an order still awaiting payment can be finished.
      checkoutExpiresAt: null,
    });
  });

  it("names cancellation refunds apart from other refunds", () => {
    const view = presentOrder(
      sampleOrderRecord({
        refunds: [
          {
            amountPence: 13_500,
            source: "cancellation",
            status: "pending",
            requestedAt: new Date("2026-10-05T09:00:00.000Z"),
            refundedAt: null,
          },
        ],
      }),
    );
    expect(view.refunds).toEqual([
      {
        amountPence: 13_500,
        kind: "cancellation",
        status: "pending",
        requestedAt: "2026-10-05T09:00:00.000Z",
        refundedAt: null,
      },
    ]);
  });

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
    const line = sampleOrderLine();
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
