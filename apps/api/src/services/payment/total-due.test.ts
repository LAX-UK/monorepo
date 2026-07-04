import type { ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { computeTotalDuePence } from "./total-due.js";

const baseLot = (overrides: Partial<Lot> = {}): Lot =>
  ({
    id: "l1",
    saleId: "s1",
    currentPrice: "1000.00",
    buyerPremiumRate: "0.25",
    ...overrides,
  }) as Lot;

describe("computeTotalDuePence", () => {
  it("uses flat lot rate when sales repo is null", async () => {
    const pence = await computeTotalDuePence(null, baseLot());
    // 1000 hammer + 25% premium = 1250 GBP = 125000 pence
    expect(pence).toBe(125_000);
  });

  it("uses flat lot rate when lot has no saleId", async () => {
    const sales = { findById: vi.fn() } as unknown as ISaleRepository;
    const pence = await computeTotalDuePence(sales, baseLot({ saleId: null }));
    expect(pence).toBe(125_000);
    expect(sales.findById).not.toHaveBeenCalled();
  });

  it("prefers sale tiers over lot rate when sale is resolved", async () => {
    const sale = {
      id: "s1",
      buyerPremiumTiers: [{ hammerThresholdMinor: 0, rate: "0.15" }],
    } as unknown as Sale;
    const sales = {
      findById: vi.fn().mockResolvedValue(sale),
    } as unknown as ISaleRepository;
    const pence = await computeTotalDuePence(
      sales,
      baseLot({ currentPrice: "1000.00", buyerPremiumRate: "0.25" }),
    );
    // 1000 + 15% = 1150 GBP
    expect(pence).toBe(115_000);
  });

  it("falls back to lot rate when sale lookup fails", async () => {
    const sales = {
      findById: vi.fn().mockRejectedValue(new Error("db down")),
    } as unknown as ISaleRepository;
    const pence = await computeTotalDuePence(sales, baseLot());
    expect(pence).toBe(125_000);
  });
});
