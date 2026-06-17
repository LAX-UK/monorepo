import type { Lot, Sale } from "@auction/types";
import { buildBuyerPremiumPolicy } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { gbpAmountToPence, gbpPenceToMajorString } from "./decimal-money.js";
import { computeLotCheckoutPricing } from "./lot-checkout-pricing.js";

const baseLot = (overrides: Partial<Lot> = {}): Lot =>
  ({
    id: "l1",
    saleId: "s1",
    currentPrice: "1000",
    buyerPremiumRate: "0.2",
    ...overrides,
  }) as Lot;

describe("computeLotCheckoutPricing", () => {
  it("uses flat lot rate when sale has no tiers", () => {
    const sale = { id: "s1", buyerPremiumTiers: null } as Sale;
    const p = computeLotCheckoutPricing(baseLot(), sale);
    expect(p.hammerMajor).toBe("1000");
    expect(p.premiumMajor).toBeTruthy();
    expect(p.totalMajor).toBeTruthy();
    expect(p.kind).toBe("flat");
  });

  it("marks tiered when sale tiers apply", () => {
    const sale = {
      id: "s1",
      buyerPremiumTiers: [{ hammerThresholdMinor: 0, rate: "0.15" }],
    } as unknown as Sale;
    const p = computeLotCheckoutPricing(baseLot({ buyerPremiumRate: "0.25" }), sale);
    expect(p.kind).toBe("tiered");
    expect(p.policyId.startsWith("tiered:")).toBe(true);
  });

  /** Mirrors PaymentService.totalDuePence — display total must match charge total. */
  function chargeTotalMajor(lot: Lot, sale: Sale | null): string {
    const policy = buildBuyerPremiumPolicy({
      saleTiers: sale?.buyerPremiumTiers ?? null,
      lotRate: lot.buyerPremiumRate,
    });
    const hammerPence = gbpAmountToPence(lot.currentPrice);
    const premiumPence = gbpAmountToPence(policy.computePremiumMajor(lot.currentPrice));
    return gbpPenceToMajorString(hammerPence + premiumPence);
  }

  it("totalMajor matches integer-pence charge path for flat and tiered premiums", () => {
    const cases: Array<{ lot: Lot; sale: Sale | null }> = [
      { lot: baseLot({ currentPrice: "1000.00", buyerPremiumRate: "0.25" }), sale: null },
      { lot: baseLot({ currentPrice: "499999.99", buyerPremiumRate: "0.25" }), sale: null },
      {
        lot: baseLot({ currentPrice: "600000.00", buyerPremiumRate: "0.25" }),
        sale: {
          id: "s1",
          buyerPremiumTiers: [
            { hammerThresholdMinor: 0, rate: "0.15" },
            { hammerThresholdMinor: 50_000_000, rate: "0.10" },
          ],
        } as unknown as Sale,
      },
    ];
    for (const { lot, sale } of cases) {
      const display = computeLotCheckoutPricing(lot, sale);
      const charge = chargeTotalMajor(lot, sale);
      expect(display.totalMajor).toBe(charge);
    }
  });
});
