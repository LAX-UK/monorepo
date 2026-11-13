import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { STANDARD_BUYER_PREMIUM_BANDS } from "./buyer-premium.js";
import {
  InvoiceSaleMissingError,
  buildInvoiceLines,
  lotTotalDuePence,
  sumInvoiceLines,
} from "./invoice-lines.js";

const lot = (
  currentPrice: string,
  buyerPremiumRate: string | null = "0.25",
  saleId: string | null = null,
) => ({ currentPrice, buyerPremiumRate, saleId }) as Lot;

const bandedSale = {
  id: "sale-1",
  buyerPremiumRate: "0.2500",
  buyerPremiumTiers: STANDARD_BUYER_PREMIUM_BANDS,
} as unknown as Sale;
const flatSale = {
  id: "sale-1",
  buyerPremiumRate: "0.2000",
  buyerPremiumTiers: null,
} as unknown as Sale;

describe("buildInvoiceLines", () => {
  it("a lot with its own premium is the hammer price and the premium at that rate", () => {
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

  it("a lot without its own premium in a flat sale pays the sale's rate", () => {
    const built = buildInvoiceLines(lot("1000.00", null, "sale-1"), flatSale);
    expect(built.lines[1]?.label).toBe("Buyer's premium (20%)");
    expect(built.totalPence).toBe(120_000);
  });

  it("a lot without its own premium in a banded sale pays the bands, slice by slice", () => {
    const built = buildInvoiceLines(lot("600000.00", null, "sale-1"), bandedSale);
    expect(built.lines[1]).toEqual({
      kind: "buyers_premium",
      label: "Buyer's premium (15% of £500,000 + 10% of £100,000)",
      ratePercent: null,
      amountPence: 8_500_000,
    });
    expect(built.totalPence).toBe(68_500_000);
    expect(built.policyId).toBe("bands:[0:0.1500,50000000:0.1000]");
  });

  it("a lot's own premium overrides the sale's bands", () => {
    const built = buildInvoiceLines(lot("1000.00", "0.18", "sale-1"), bandedSale);
    expect(built.lines[1]?.label).toBe("Buyer's premium (18%)");
    expect(built.totalPence).toBe(118_000);
  });

  it("a lot outside any sale with no premium of its own pays the standard premium", () => {
    const built = buildInvoiceLines(lot("600000.00", null), null);
    expect(built.lines[1]?.amountPence).toBe(8_500_000);
  });

  it.each([
    ["just under the band edge", "499999.99", 7_500_000, 57_499_999, "15% of £499,999.99"],
    ["at the band edge", "500000.00", 7_500_000, 57_500_000, "15% of £500,000"],
    ["a penny over", "500000.01", 7_500_000, 57_500_001, "15% of £500,000 + 10% of £0.01"],
    ["at £600,000", "600000.00", 8_500_000, 68_500_000, "15% of £500,000 + 10% of £100,000"],
  ] as const)("standard bands %s", (_name, hammer, premium, total, breakdown) => {
    const built = buildInvoiceLines(lot(hammer, null, "sale-1"), bandedSale);
    expect(built.lines[1]?.amountPence).toBe(premium);
    expect(built.lines[1]?.label).toBe(`Buyer's premium (${breakdown})`);
    expect(built.totalPence).toBe(total);
  });

  it("rounds each premium half up, to the penny", () => {
    // 10p at 5% = 0.5p -> 1p; 30p at 5% = 1.5p -> 2p; 50p at 5% = 2.5p -> 3p.
    expect(buildInvoiceLines(lot("0.10", "0.05"), null).lines[1]?.amountPence).toBe(1);
    expect(buildInvoiceLines(lot("0.30", "0.05"), null).lines[1]?.amountPence).toBe(2);
    expect(buildInvoiceLines(lot("0.50", "0.05"), null).lines[1]?.amountPence).toBe(3);
    // 0.70 at 5% = 3.5p -> 4p; 0.08 at 5% = 0.4p -> nothing charged.
    expect(buildInvoiceLines(lot("0.70", "0.05"), null).lines[1]?.amountPence).toBe(4);
    expect(buildInvoiceLines(lot("0.08", "0.05"), null).lines).toHaveLength(1);
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
    for (const l of buildInvoiceLines(lot("600000.00", null, "sale-1"), bandedSale).lines) {
      expect(l.label.toLowerCase()).not.toContain("vat");
    }
  });

  it("the lines always add up to the total", () => {
    for (const price of ["0.01", "0.07", "33.33", "1234.57", "99999.99", "999999.99"]) {
      for (const rate of [null, "0", "0.0725", "0.2333", "0.25", "0.3"]) {
        const built = buildInvoiceLines(lot(price, rate, "sale-1"), bandedSale);
        expect(sumInvoiceLines(built.lines)).toBe(built.totalPence);
        expect(lotTotalDuePence(lot(price, rate, "sale-1"), bandedSale)).toBe(built.totalPence);
      }
    }
  });

  it("a lot in a sale that cannot be found is not priced", () => {
    expect(() => buildInvoiceLines(lot("1000.00", "0.25", "sale-1"), null)).toThrow(
      InvoiceSaleMissingError,
    );
  });
});
