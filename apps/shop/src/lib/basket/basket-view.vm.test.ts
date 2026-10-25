import type { BasketLine } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { presentBasketLine, presentBasketSummary } from "./basket-view.vm";

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
      restore: { kind: "edition", artworkSlug: "warm-basket" },
    });
  });

  it("states the rule, not the stock, when the ceiling is lower than the rule", () => {
    const vm = presentBasketLine({ ...edition, maxQuantity: 1 });
    expect(vm.maxQuantity).toBe(1);
    expect(vm.limitHint).toBe("Limit 2 per order");
  });

  it("falls back to the rule when an older shop-api sends no ceiling or artist", () => {
    const { maxQuantity: _m, artistName: _a, artistSlug: _s, editionSize: _e, ...older } = edition;
    const vm = presentBasketLine(older);
    expect(vm.maxQuantity).toBe(2);
    expect(vm.artistName).toBeNull();
    expect(vm.detail).toBeNull();
    expect(vm.imageAlt).toBe("Warm Basket");
  });

  it("shows a merchandise line by its SKU, with no edition rule", () => {
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
  it("adds UK insured delivery, as checkout does by default, to reach the total", () => {
    const summary = presentBasketSummary({
      lines: [edition, { ...edition, lineId: "x", quantity: 2 }],
      merchandiseSubtotalPence: 36000,
    });
    expect(summary).toMatchObject({
      itemCountLabel: "Subtotal (3 items)",
      subtotal: "£360.00",
      delivery: "£15.00",
      total: "£375.00",
      deliveryNote: "Collection in London is free. Choose it at checkout.",
    });
  });

  it("counts one item in the singular", () => {
    expect(
      presentBasketSummary({ lines: [edition], merchandiseSubtotalPence: 12000 }).itemCountLabel,
    ).toBe("Subtotal (1 item)");
  });
});
