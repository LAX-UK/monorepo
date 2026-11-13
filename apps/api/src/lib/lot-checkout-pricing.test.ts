import type { Lot, Sale } from "@auction/types";
import { STANDARD_BUYER_PREMIUM_BANDS, buildInvoiceLines } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { gbpPenceToMajorString } from "./decimal-money.js";
import { computeLotCheckoutPricing } from "./lot-checkout-pricing.js";

const baseLot = (overrides: Partial<Lot> = {}): Lot =>
  ({
    id: "l1",
    saleId: "s1",
    currentPrice: "1000",
    buyerPremiumRate: null,
    ...overrides,
  }) as Lot;

const flatSale = { id: "s1", buyerPremiumRate: "0.2", buyerPremiumTiers: null } as Sale;
const bandedSale = {
  id: "s1",
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: [...STANDARD_BUYER_PREMIUM_BANDS],
} as unknown as Sale;

describe("computeLotCheckoutPricing", () => {
  it("a lot without its own premium in a flat sale pays the sale's rate", () => {
    const p = computeLotCheckoutPricing(baseLot(), flatSale);
    expect(p.premiumMajor).toBe("200.00");
    expect(p.kind).toBe("flat");
    expect(p.premium?.source).toBe("sale_flat");
  });

  it("marks a banded premium when the sale's bands apply", () => {
    const p = computeLotCheckoutPricing(baseLot({ currentPrice: "600000.00" }), bandedSale);
    expect(p.kind).toBe("tiered");
    expect(p.policyId.startsWith("bands:")).toBe(true);
    expect(p.premiumMajor).toBe("85000.00");
  });

  it("a lot's own premium wins over the sale's bands", () => {
    const p = computeLotCheckoutPricing(baseLot({ buyerPremiumRate: "0.25" }), bandedSale);
    expect(p.kind).toBe("flat");
    expect(p.premium?.source).toBe("lot");
    expect(p.premiumMajor).toBe("250.00");
  });

  it("the displayed total is the invoice total, for every way a premium is set", () => {
    const cases: Array<{ lot: Lot; sale: Sale | null }> = [
      { lot: baseLot({ currentPrice: "1000.00", buyerPremiumRate: "0.25" }), sale: flatSale },
      { lot: baseLot({ currentPrice: "499999.99" }), sale: bandedSale },
      { lot: baseLot({ currentPrice: "500000.01" }), sale: bandedSale },
      { lot: baseLot({ currentPrice: "600000.00" }), sale: bandedSale },
      { lot: baseLot({ currentPrice: "600000.00", saleId: null }), sale: null },
    ];
    for (const { lot, sale } of cases) {
      const display = computeLotCheckoutPricing(lot, sale);
      expect(display.totalMajor).toBe(
        gbpPenceToMajorString(buildInvoiceLines(lot, sale).totalPence),
      );
    }
  });
});
