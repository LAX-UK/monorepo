import { describe, expect, it } from "vitest";
import {
  type CheckoutEditionRow,
  groupCheckoutEditionLines,
  groupCheckoutFramingLines,
} from "./shop-checkout-stripe-presentation.js";
import { buildStripeLineItems } from "./stripe-shop-checkout.gateway.js";

const row = (over: Partial<CheckoutEditionRow>): CheckoutEditionRow => ({
  artworkId: "art-1",
  editionNumber: 1,
  unitPricePence: 8_500,
  title: "Harbour at dusk",
  imageUrl: null,
  artistName: "Ines Calder",
  ...over,
});

const total = (lines: ReturnType<typeof groupCheckoutEditionLines>) =>
  lines.reduce((sum, line) => sum + line.unitAmountPence * line.quantity, 0);

describe("groupCheckoutEditionLines", () => {
  it("charges for an open edition, which has no edition number", () => {
    const lines = groupCheckoutEditionLines([
      row({
        artworkId: "night-garden",
        title: "Night garden",
        editionNumber: null,
        unitPricePence: 9_500,
      }),
    ]);
    expect(lines).toEqual([
      {
        title: "Night garden",
        description: "Ines Calder",
        quantity: 1,
        unitAmountPence: 9_500,
        imageUrl: null,
      },
    ]);
    expect(total(lines)).toBe(9_500);
  });

  it("adds up to the order total for numbered and unnumbered editions together", () => {
    const lines = groupCheckoutEditionLines([
      row({ editionNumber: 3 }),
      row({ editionNumber: 1 }),
      row({ artworkId: "night-garden", editionNumber: null, unitPricePence: 9_500 }),
      row({ artworkId: "night-garden", editionNumber: null, unitPricePence: 9_500 }),
    ]);
    expect(total(lines)).toBe(2 * 8_500 + 2 * 9_500);
    expect(lines[0]?.description).toBe("Ines Calder · Editions 1, 3");
    expect(lines[1]?.quantity).toBe(2);
  });

  it("keeps editions of one artwork at different prices on their own lines", () => {
    const lines = groupCheckoutEditionLines([
      row({ editionNumber: 1, unitPricePence: 8_500 }),
      row({ editionNumber: 2, unitPricePence: 9_500 }),
    ]);
    expect(lines.map((line) => line.unitAmountPence)).toEqual([8_500, 9_500]);
    expect(total(lines)).toBe(18_000);
  });
});

describe("groupCheckoutFramingLines", () => {
  it("shows one line per option and price, with the quantity framed", () => {
    const lines = groupCheckoutFramingLines([
      { name: "Natural oak frame", unitPricePence: 21_000 },
      { name: "Natural oak frame", unitPricePence: 21_000 },
      { name: "Black wood frame", unitPricePence: 19_500 },
    ]);
    expect(lines).toEqual([
      {
        title: "Natural oak frame",
        description: "Framing",
        quantity: 2,
        unitAmountPence: 21_000,
        imageUrl: null,
      },
      {
        title: "Black wood frame",
        description: "Framing",
        quantity: 1,
        unitAmountPence: 19_500,
        imageUrl: null,
      },
    ]);
  });

  it("keeps the same option at two prices apart", () => {
    const lines = groupCheckoutFramingLines([
      { name: "Natural oak frame", unitPricePence: 21_000 },
      { name: "Natural oak frame", unitPricePence: 19_500 },
    ]);
    expect(lines.map((line) => line.unitAmountPence)).toEqual([21_000, 19_500]);
  });
});

describe("the payment lines of a framed order", () => {
  it("add up to the order total: the prints, the frames and the delivery", () => {
    const prints = groupCheckoutEditionLines([
      row({ editionNumber: 1 }),
      row({ editionNumber: 2 }),
    ]);
    const frames = groupCheckoutFramingLines([
      { name: "Natural oak frame", unitPricePence: 21_000 },
      { name: "Natural oak frame", unitPricePence: 21_000 },
    ]);
    const items = buildStripeLineItems({
      lines: [...prints, ...frames],
      fulfilmentSurchargePence: 1_500,
      totalPence: 2 * 8_500 + 2 * 21_000 + 1_500,
    });
    expect(items.map((item) => item.price_data?.product_data?.name)).toEqual([
      "Harbour at dusk",
      "Natural oak frame",
      "Delivery & fulfilment",
    ]);
  });

  it("would not add up without the frames, which is what the sum check guards", () => {
    const prints = groupCheckoutEditionLines([row({ editionNumber: 1 })]);
    expect(() =>
      buildStripeLineItems({
        lines: prints,
        fulfilmentSurchargePence: 1_500,
        totalPence: 8_500 + 21_000 + 1_500,
      }),
    ).toThrowError("Checkout line items do not match order total");
  });
});
