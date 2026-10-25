import type { BasketLine } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { basketLineStepperHint, presentBasketLine, presentBasketSummary } from "./basket-view.vm";

const edition: BasketLine = {
  lineId: "00000000-0000-4000-8000-000000000001",
  artworkSlug: "warm-basket",
  artworkTitle: "Warm Basket",
  productVariantId: null,
  productSlug: null,
  productTitle: null,
  variantSku: null,
  unitPricePence: 12000,
  quantity: 1,
  soldOut: false,
  priceChanged: false,
  outOfStock: false,
  imageUrl: "/warm.webp",
  artistName: "Emmett King",
  artistSlug: "emmett-king",
  editionSize: 24,
  orderLimit: 2,
  maxQuantity: 2,
};

describe("presentBasketLine", () => {
  it("names the work, the artist and the edition, with links to both", () => {
    expect(presentBasketLine(edition)).toMatchObject({
      title: "Warm Basket",
      href: "/artworks/warm-basket",
      artistName: "Emmett King",
      artistHref: "/artists/emmett-king",
      detail: "Limited edition of 24",
      imageAlt: "Warm Basket by Emmett King",
      unitPrice: "£120.00",
      maxQuantity: 2,
      limitHint: "Limit 2 per order",
      cappedByAvailability: false,
      restore: { kind: "edition", artworkSlug: "warm-basket" },
    });
  });

  it("takes the limit copy from the line's own limit", () => {
    expect(presentBasketLine({ ...edition, orderLimit: 3, maxQuantity: 3 }).limitHint).toBe(
      "Limit 3 per order",
    );
    expect(
      presentBasketLine({ ...edition, orderLimit: null, maxQuantity: 5 }).limitHint,
    ).toBeNull();
  });

  it("gives a reason, not a count, when availability stops the stepper below the limit", () => {
    const vm = presentBasketLine({ ...edition, maxQuantity: 1 });
    expect(vm.cappedByAvailability).toBe(true);
    expect(basketLineStepperHint(vm, 1)).toBe("No more available to order");
    const atLimit = presentBasketLine({ ...edition, quantity: 2 });
    expect(basketLineStepperHint(atLimit, 2)).toBe("Limit 2 per order");
  });

  it("reads a response from an older shop-api without a ceiling, limit or artist", () => {
    const {
      maxQuantity: _m,
      orderLimit: _o,
      artistName: _a,
      artistSlug: _s,
      editionSize: _e,
      ...older
    } = edition;
    const vm = presentBasketLine(older);
    expect(vm.maxQuantity).toBe(24);
    expect(vm.limitHint).toBeNull();
    expect(vm.artistName).toBeNull();
    expect(vm.detail).toBeNull();
    expect(vm.imageAlt).toBe("Warm Basket");
  });

  it("shows a merchandise line by its SKU", () => {
    const vm = presentBasketLine({
      ...edition,
      artworkSlug: null,
      artworkTitle: null,
      productVariantId: "00000000-0000-4000-8000-000000000009",
      productSlug: "tote",
      productTitle: "Tote bag",
      variantSku: "TOTE-1",
      artistName: null,
      artistSlug: null,
      editionSize: null,
      orderLimit: null,
      maxQuantity: 24,
    });
    expect(vm).toMatchObject({
      title: "Tote bag",
      href: "/merchandise/tote",
      detail: "SKU TOTE-1",
      limitHint: null,
      restore: { kind: "merchandise", variantId: "00000000-0000-4000-8000-000000000009" },
    });
  });
});

describe("presentBasketSummary", () => {
  it("sums the line totals and counts every copy, then adds UK insured delivery", () => {
    const summary = presentBasketSummary([
      { unitPricePence: 12000, quantity: 2 },
      { unitPricePence: 8500, quantity: 1 },
    ]);
    expect(summary).toMatchObject({
      itemCountLabel: "Subtotal (3 items)",
      subtotal: "£325.00",
      delivery: "£15.00",
      total: "£340.00",
      deliveryNote: "Collection in London is free. Choose it at checkout.",
    });
  });

  it("counts one item in the singular", () => {
    expect(presentBasketSummary([{ unitPricePence: 12000, quantity: 1 }]).itemCountLabel).toBe(
      "Subtotal (1 item)",
    );
  });
});
