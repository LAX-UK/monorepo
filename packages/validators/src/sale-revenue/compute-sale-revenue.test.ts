import { describe, expect, it } from "vitest";
import {
  composeTieredRevenueDailySeries,
  computeSaleExpectedRevenue,
} from "./compute-sale-revenue.js";

describe("computeSaleExpectedRevenue", () => {
  it("sums hammer + flat premium per lot", () => {
    const total = computeSaleExpectedRevenue({
      sale: { buyerPremiumRate: "0.25", buyerPremiumTiers: null },
      lots: [
        { currentPrice: "1000.00", buyerPremiumRate: null },
        { currentPrice: "2000.00", buyerPremiumRate: "0.10" },
      ],
    });
    expect(total).toBe("3450.00");
  });

  it("charges the sale's bands slice by slice, and a lot's own premium over them", () => {
    const total = computeSaleExpectedRevenue({
      sale: {
        buyerPremiumRate: "0.25",
        buyerPremiumTiers: [
          { hammerThresholdMinor: 0, rate: "0.15" },
          { hammerThresholdMinor: 500_000_00, rate: "0.10" },
        ],
      },
      lots: [
        { currentPrice: "600000.00", buyerPremiumRate: null },
        { currentPrice: "1000.00", buyerPremiumRate: "0.20" },
      ],
    });
    // 600,000 + 85,000 (15% of 500k + 10% of 100k), and 1,000 + 200 at the lot's own 20%.
    expect(total).toBe("686200.00");
  });

  it("uses sale tiers when configured", () => {
    const total = computeSaleExpectedRevenue({
      sale: {
        buyerPremiumRate: "0.25",
        buyerPremiumTiers: [
          { hammerThresholdMinor: 0, rate: "0.20" },
          { hammerThresholdMinor: 500_000_00, rate: "0.10" },
        ],
      },
      lots: [{ currentPrice: "600000.00", buyerPremiumRate: null }],
    });
    // 20% of £500,000 + 10% of £100,000.
    expect(total).toBe("710000.00");
  });

  it("returns zero for empty lots", () => {
    expect(
      computeSaleExpectedRevenue({
        sale: { buyerPremiumRate: "0.25", buyerPremiumTiers: null },
        lots: [],
      }),
    ).toBe("0");
  });
});

describe("composeTieredRevenueDailySeries", () => {
  it("aggregates premium-inclusive revenue by day", () => {
    const byDay = composeTieredRevenueDailySeries({
      sale: { buyerPremiumRate: "0.25", buyerPremiumTiers: null },
      rows: [
        {
          dayKey: "2026-01-01",
          lotId: "lot-1",
          amountPence: 100_000,
          lotBuyerPremiumRate: null,
        },
        {
          dayKey: "2026-01-01",
          lotId: "lot-2",
          amountPence: 50_000,
          lotBuyerPremiumRate: null,
        },
        {
          dayKey: "2026-01-02",
          lotId: "lot-1",
          amountPence: 20_000,
          lotBuyerPremiumRate: null,
        },
      ],
    });
    expect(byDay.get("2026-01-01")).toBe(187_500);
    expect(byDay.get("2026-01-02")).toBe(25_000);
  });
});
