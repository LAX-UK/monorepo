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
  editionLine: "Limited edition of 24 · Hand-signed",
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
      detail: "Limited edition of 24 · Hand-signed",
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
      editionLine: _l,
      ...older
    } = edition;
    const vm = presentBasketLine(older);
    expect(vm.maxQuantity).toBe(10);
    expect(vm.limitHint).toBeNull();
    expect(vm.artistName).toBeNull();
    expect(vm.detail).toBeNull();
    expect(vm.imageAlt).toBe("Warm Basket");
  });

  it("keeps the edition year out of the shared edition line", () => {
    const vm = presentBasketLine({ ...edition, editionYear: 2024 });
    expect(vm.detail).toBe("Limited edition of 24 · Hand-signed");
    expect(vm.yearSuffix).toBe(", 2024");
  });

  it("shows the year on its own when the edition line is absent, as the product page does", () => {
    const vm = presentBasketLine({ ...edition, editionLine: null, editionYear: 2024 });
    expect(vm.detail).toBeNull();
    expect(vm.yearSuffix).toBe(", 2024");
  });

  it("shows no year when it is unrecorded, and none for merchandise", () => {
    expect(presentBasketLine({ ...edition, editionYear: null }).yearSuffix).toBeNull();
    expect(
      presentBasketLine({ ...edition, editionLine: "Limited edition of 24" }).yearSuffix,
    ).toBeNull();
    expect(
      presentBasketLine({
        ...edition,
        artworkSlug: null,
        productVariantId: "00000000-0000-4000-8000-000000000009",
        editionYear: 2024,
      }).yearSuffix,
    ).toBeNull();
  });

  it("says both prices when the price has risen, using the money formatter", () => {
    expect(
      presentBasketLine({
        ...edition,
        priceChanged: true,
        previousUnitPricePence: 18000,
        currentUnitPricePence: 20000,
      }).priceChangeText,
    ).toBe("Was £180.00, now £200.00.");
  });

  it("says both prices when the price has dropped", () => {
    expect(
      presentBasketLine({
        ...edition,
        priceChanged: true,
        previousUnitPricePence: 20000,
        currentUnitPricePence: 18000,
      }).priceChangeText,
    ).toBe("Was £200.00, now £180.00.");
  });

  it("says nothing about prices when unchanged, or when an older shop-api sends no figures", () => {
    expect(presentBasketLine(edition).priceChangeText).toBeNull();
    expect(presentBasketLine({ ...edition, priceChanged: true }).priceChangeText).toBeNull();
  });

  it("words an open edition from the contract, with no size", () => {
    const vm = presentBasketLine({
      ...edition,
      editionSize: null,
      editionLine: "Open edition · Unsigned",
    });
    expect(vm.detail).toBe("Open edition · Unsigned");
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
      editionLine: null,
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
      totalLabel: "Total, including VAT",
      deliveryNote: "Collection in London is free. Choose it at checkout.",
    });
  });

  it("works out checkout's total for the delivery chosen there", () => {
    const lines = [{ unitPricePence: 12000, quantity: 1 }];
    expect(presentBasketSummary(lines, "collect_new_cavendish")).toMatchObject({
      deliveryLabel: "Collection in London",
      delivery: "Free",
      total: "£120.00",
    });
    expect(presentBasketSummary(lines, "international_quotation")).toMatchObject({
      totalLabel: "Total before delivery, including VAT",
      total: "£120.00",
    });
  });

  it("counts one item in the singular", () => {
    expect(presentBasketSummary([{ unitPricePence: 12000, quantity: 1 }]).itemCountLabel).toBe(
      "Subtotal (1 item)",
    );
  });
});
