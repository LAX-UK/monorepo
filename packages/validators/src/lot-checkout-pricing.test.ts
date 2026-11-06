import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { lotTotalDuePence } from "./invoice-lines.js";
import { computeLotCheckoutPricing } from "./lot-checkout-pricing.js";

const lot = (currentPrice: string, buyerPremiumRate = "0.25") =>
  ({ currentPrice, buyerPremiumRate, saleId: null }) as Lot;
const tiered = {
  buyerPremiumTiers: [
    { hammerThresholdMinor: 0, rate: "0.1500" },
    { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
  ],
} as unknown as Sale;

describe("lotTotalDuePence (the one invoice total)", () => {
  it.each([
    ["flat 25%", lot("1000.00"), null, 125_000],
    ["a penny hammer", lot("0.01"), null, 1],
    ["tier just under the band edge", lot("499999.99"), tiered, 57_499_999],
    ["tier at the band edge", lot("500000.00"), tiered, 55_000_000],
  ] as const)("%s", (_name, l, sale, pence) => {
    expect(lotTotalDuePence(l, sale)).toBe(pence);
  });

  it("the displayed total is exactly hammer plus premium, to the penny", () => {
    for (const price of ["0.07", "33.33", "1234.57", "999999.99"]) {
      const pricing = computeLotCheckoutPricing(lot(price, "0.2333"), null);
      const parts =
        Math.round(Number(pricing.hammerMajor) * 100) +
        Math.round(Number(pricing.premiumMajor) * 100);
      expect(Math.round(Number(pricing.totalMajor) * 100)).toBe(parts);
      expect(lotTotalDuePence(lot(price, "0.2333"), null)).toBe(parts);
    }
  });
});
