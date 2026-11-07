import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  InvoiceSaleMissingError,
  buildInvoiceLines,
  lotTotalDuePence,
  sumInvoiceLines,
} from "./invoice-lines.js";

const lot = (currentPrice: string, buyerPremiumRate = "0.25", saleId: string | null = null) =>
  ({ currentPrice, buyerPremiumRate, saleId }) as Lot;

const tieredSale = {
  id: "sale-1",
  buyerPremiumTiers: [
    { hammerThresholdMinor: 0, rate: "0.1500" },
    { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
  ],
} as unknown as Sale;
const flatSale = { id: "sale-1", buyerPremiumTiers: null } as unknown as Sale;

describe("buildInvoiceLines", () => {
  it("a flat lot is the hammer price and the premium at the lot's rate", () => {
    const built = buildInvoiceLines(lot("1000.00"), null);
    expect(built.lines).toEqual([
      { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 100_000 },
      {
        kind: "buyers_premium",
        label: "Buyer's premium (25%)",
        ratePercent: "25",
        amountPence: 25_000,
      },
    ]);
    expect(built.totalPence).toBe(125_000);
    expect(built.policyId).toBe("flat:0.25");
  });

  it("a sale without tiers prices the lot at its own rate", () => {
    const built = buildInvoiceLines(lot("1000.00", "0.2", "sale-1"), flatSale);
    expect(built.lines[1]?.label).toBe("Buyer's premium (20%)");
    expect(built.totalPence).toBe(120_000);
  });

  it("a tiered sale overrides the lot's rate and says so", () => {
    const built = buildInvoiceLines(lot("1000.00", "0.25", "sale-1"), tieredSale);
    expect(built.lines[1]).toEqual({
      kind: "buyers_premium",
      label: "Buyer's premium (tiered)",
      ratePercent: "15",
      amountPence: 15_000,
    });
    expect(built.totalPence).toBe(115_000);
    expect(built.policyId.startsWith("tiered:")).toBe(true);
  });

  it.each([
    ["just under the band edge", "499999.99", "15", 7_500_000, 57_499_999],
    ["at the band edge", "500000.00", "10", 5_000_000, 55_000_000],
  ] as const)("tier band %s", (_name, hammer, percent, premium, total) => {
    const built = buildInvoiceLines(lot(hammer, "0.25", "sale-1"), tieredSale);
    expect(built.lines[1]?.ratePercent).toBe(percent);
    expect(built.lines[1]?.amountPence).toBe(premium);
    expect(built.totalPence).toBe(total);
  });

  it("rounds each premium half to even, to the penny", () => {
    // 0.5p exactly: 10p at 5% = 0.5p -> 0 (even); 30p at 5% = 1.5p -> 2 (even)
    expect(buildInvoiceLines(lot("0.10", "0.05"), null).lines).toHaveLength(1);
    expect(buildInvoiceLines(lot("0.30", "0.05"), null).lines[1]?.amountPence).toBe(2);
    // 0.70 at 5% = 3.5p -> 4 (even); 0.50 at 5% = 2.5p -> 2 (even)
    expect(buildInvoiceLines(lot("0.70", "0.05"), null).lines[1]?.amountPence).toBe(4);
    expect(buildInvoiceLines(lot("0.50", "0.05"), null).lines[1]?.amountPence).toBe(2);
  });

  it("a rate with a fraction of a percent keeps it", () => {
    expect(buildInvoiceLines(lot("1000.00", "0.125"), null).lines[1]?.ratePercent).toBe("12.5");
  });

  it("leaves out a premium line that is nothing", () => {
    const built = buildInvoiceLines(lot("1000.00", "0"), null);
    expect(built.lines.map((l) => l.kind)).toEqual(["hammer"]);
    expect(built.totalPence).toBe(100_000);
  });

  it("never says whether VAT is included in the premium", () => {
    for (const l of buildInvoiceLines(lot("1000.00", "0.25"), null).lines) {
      expect(l.label.toLowerCase()).not.toContain("vat");
    }
  });

  it("the lines always add up to the total", () => {
    for (const price of ["0.01", "0.07", "33.33", "1234.57", "99999.99", "999999.99"]) {
      for (const rate of ["0", "0.0725", "0.2333", "0.25", "0.3"]) {
        const built = buildInvoiceLines(lot(price, rate), null);
        expect(sumInvoiceLines(built.lines)).toBe(built.totalPence);
        expect(lotTotalDuePence(lot(price, rate), null)).toBe(built.totalPence);
      }
    }
  });

  it("a lot in a sale that cannot be found is not priced", () => {
    expect(() => buildInvoiceLines(lot("1000.00", "0.25", "sale-1"), null)).toThrow(
      InvoiceSaleMissingError,
    );
  });
});
