import { describe, expect, it } from "vitest";
import {
  type CheckoutEditionRow,
  groupCheckoutEditionLines,
} from "./shop-checkout-stripe-presentation.js";

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
