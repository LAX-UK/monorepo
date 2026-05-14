import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
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
});
