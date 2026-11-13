import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { lotTotalDuePence } from "./invoice-lines.js";
import { computeLotCheckoutPricing } from "./lot-checkout-pricing.js";

const lot = (currentPrice: string, buyerPremiumRate: string | null = "0.25") =>
  ({ currentPrice, buyerPremiumRate, saleId: null }) as Lot;
const tiered = {
  buyerPremiumRate: "0.2500",
  buyerPremiumTiers: [
    { hammerThresholdMinor: 0, rate: "0.1500" },
    { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
  ],
} as unknown as Sale;

describe("lotTotalDuePence (the one invoice total)", () => {
  it.each([
    ["flat 25%", lot("1000.00"), null, 125_000],
    ["a penny hammer", lot("0.01"), null, 1],
    ["bands just under the band edge", lot("499999.99", null), tiered, 57_499_999],
    ["bands at the band edge", lot("500000.00", null), tiered, 57_500_000],
    ["bands a penny over the edge", lot("500000.01", null), tiered, 57_500_001],
    ["bands at £600,000", lot("600000.00", null), tiered, 68_500_000],
    ["a lot's own rate over the bands", lot("1000.00", "0.25"), tiered, 125_000],
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

describe("computeLotCheckoutPricing", () => {
  it("says which premium applies, where it came from and how it was worked out", () => {
    const pricing = computeLotCheckoutPricing(lot("600000.00", null), tiered);
    expect(pricing.premiumMajor).toBe("85000.00");
    expect(pricing.totalMajor).toBe("685000.00");
    expect(pricing.kind).toBe("tiered");
    expect(pricing.premium?.source).toBe("sale_bands");
    expect(pricing.premium?.breakdown).toEqual([
      { rate: "0.1500", baseMinor: 50_000_000 },
      { rate: "0.1000", baseMinor: 10_000_000 },
    ]);
  });

  it("marks a lot's own premium as an override", () => {
    const pricing = computeLotCheckoutPricing(lot("1000.00", "0.20"), tiered);
    expect(pricing.premium?.source).toBe("lot");
    expect(pricing.kind).toBe("flat");
  });
});
