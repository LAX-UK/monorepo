import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { lotViewItemPriceMinor } from "./lot-view-item-price";

const base = {
  currentPrice: "0",
  marketingDetails: {},
} satisfies Pick<Lot, "currentPrice" | "marketingDetails">;

describe("lotViewItemPriceMinor", () => {
  it("uses current price in minor units when positive", () => {
    expect(lotViewItemPriceMinor({ ...base, currentPrice: "123.45" })).toBe(12345);
  });

  it("falls back to estimate low when current is zero", () => {
    expect(
      lotViewItemPriceMinor({
        ...base,
        currentPrice: "0",
        marketingDetails: { estimate: { low: "500", high: "800", currency: "GBP" } },
      }),
    ).toBe(50000);
  });

  it("returns undefined when no usable price", () => {
    expect(lotViewItemPriceMinor(base)).toBeUndefined();
  });
});
