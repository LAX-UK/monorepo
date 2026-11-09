import {
  basketCheckoutBlockMessage,
  basketCheckoutBlockReasons,
  canProceedToCheckout,
} from "@/lib/basket-checkout-eligibility";
import {
  presentDeliveryLine,
  shiftDeliveryTimes,
} from "@/lib/presenters/delivery-estimate.presenter";
import type { BasketLine, BasketView } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { presentBasketLine, presentBasketSummary } from "./basket-view.vm";

const OAK = "00000000-0000-4000-8000-0000000000a1";

const line: BasketLine = {
  lineId: "00000000-0000-4000-8000-000000000001",
  artworkSlug: "tide-line",
  artworkTitle: "Tide line",
  productVariantId: null,
  productSlug: null,
  productTitle: null,
  variantSku: null,
  unitPricePence: 18000,
  quantity: 2,
  soldOut: false,
  priceChanged: false,
  outOfStock: false,
  imageUrl: null,
  framing: {
    optionId: OAK,
    name: "Natural oak frame",
    frame: "natural_oak",
    mount: "window_conservation",
    glazing: "uv_acrylic",
    hanging: "d_rings_cord",
    pricePence: 21000,
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    available: true,
  },
};

describe("a basket line with framing", () => {
  it("describes the frame and prices it for the whole line while it can be bought", () => {
    const vm = presentBasketLine(line);
    expect(vm.framing).toMatchObject({
      name: "Natural oak frame",
      detail: "White conservation mount, UV-filtering acrylic · adds 10 to 15 working days",
      priceLabel: "£210.00",
      unitPence: 21000,
      linePence: 42000,
      available: true,
      unavailableMessage: null,
    });
  });

  it("charges nothing for a frame that is no longer offered, and tells the shopper", () => {
    const vm = presentBasketLine({
      ...line,
      framing: line.framing ? { ...line.framing, available: false } : null,
    });
    expect(vm.framing).toMatchObject({
      unitPence: 0,
      linePence: 0,
      available: false,
      unavailableMessage:
        "Natural oak frame is no longer offered. Choose another framing or unframed.",
    });
  });

  it("has no framing when the print is unframed", () => {
    expect(presentBasketLine({ ...line, framing: null }).framing).toBeNull();
    // A line from an older shop-api carries no framing field at all.
    const { framing: _dropped, ...older } = line;
    expect(presentBasketLine(older).framing).toBeNull();
  });

  it("keeps the frame when a removed line is put back", () => {
    expect(presentBasketLine(line).restore).toEqual({
      kind: "edition",
      artworkSlug: "tide-line",
      framingOptionId: OAK,
    });
  });
});

describe("the basket summary with framing", () => {
  it("adds framing to the subtotal and the total", () => {
    const summary = presentBasketSummary([
      { unitPricePence: 18000, quantity: 2, framingUnitPence: 21000 },
      { unitPricePence: 5000, quantity: 1 },
    ]);
    expect(summary.itemCountLabel).toBe("Subtotal (3 items)");
    expect(summary.subtotal).toBe("£830.00");
    expect(summary.total).toBe("£845.00");
  });

  it("is unchanged for lines without framing", () => {
    expect(presentBasketSummary([{ unitPricePence: 18000, quantity: 1 }]).subtotal).toBe("£180.00");
  });
});

describe("checkout eligibility with framing", () => {
  const basket = (lines: BasketLine[]): BasketView => ({
    basketId: "00000000-0000-4000-8000-0000000000bb",
    lines,
    merchandiseSubtotalPence: 36000,
    expiresAt: "2030-01-01T00:00:00.000Z",
  });

  it("lets a basket without framing through", () => {
    expect(canProceedToCheckout(basket([{ ...line, framing: null }]))).toBe(true);
  });

  it("stops a basket holding a frame while orders cannot carry one, and says so plainly", () => {
    const stopped = basket([line]);
    expect(canProceedToCheckout(stopped)).toBe(false);
    expect(basketCheckoutBlockReasons(stopped)).toEqual(["framing_not_orderable"]);
    expect(basketCheckoutBlockMessage(["framing_not_orderable"])).toBe(
      "Framing can't be ordered yet. Choose unframed for the prints that have a frame, then check out.",
    );
  });

  it("also flags a frame that is no longer offered", () => {
    const stopped = basket([
      { ...line, framing: line.framing ? { ...line.framing, available: false } : null },
    ]);
    expect(basketCheckoutBlockReasons(stopped)).toEqual([
      "framing_unavailable",
      "framing_not_orderable",
    ]);
  });
});

describe("delivery dates with framing", () => {
  const NOW = new Date("2026-11-02T10:00:00.000Z");
  const TIMES = { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } };

  it("adds the option's lead time to both ends of the delivery and collection windows", () => {
    expect(shiftDeliveryTimes(TIMES, { minDays: 10, maxDays: 15 })).toEqual({
      ukDelivery: { min: 13, max: 20 },
      collection: { min: 12, max: 17 },
    });
  });

  it("leaves the windows alone for an unframed print, and keeps an unset time unset", () => {
    expect(shiftDeliveryTimes(TIMES, null)).toBe(TIMES);
    expect(
      shiftDeliveryTimes({ ukDelivery: null, collection: null }, { minDays: 10, maxDays: 15 }),
    ).toEqual({ ukDelivery: null, collection: null });
  });

  it("moves the dates in the line shown under the button", () => {
    const plain = presentDeliveryLine({ now: NOW, times: TIMES });
    const framed = presentDeliveryLine({
      now: NOW,
      times: TIMES,
      framingLead: { minDays: 10, maxDays: 15 },
    });
    expect(plain).toContain("arrives 5 to 9 Nov");
    expect(plain).toContain("ready Wed 4 Nov");
    expect(framed).toContain("arrives 19 to 30 Nov");
    expect(framed).toContain("ready Wed 18 Nov");
    expect(framed).toContain("Insured UK delivery £15");
  });
});
