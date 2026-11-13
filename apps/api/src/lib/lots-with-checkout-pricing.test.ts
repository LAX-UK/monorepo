import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { lotsWithCheckoutPricing } from "./lots-with-checkout-pricing.js";

const sale = { id: "s1", buyerPremiumRate: "0.2500", buyerPremiumTiers: null } as Sale;
const lot = (id: string, over: Partial<Lot> = {}) =>
  ({
    id,
    saleId: "s1",
    status: "ended",
    winnerId: "buyer",
    currentPrice: "1000.00",
    buyerPremiumRate: null,
    ...over,
  }) as Lot;

describe("lotsWithCheckoutPricing", () => {
  it("prices sold, invoiced lots from the invoice and the rest under the sale's premium", async () => {
    const invoicedSalePrices = {
      findInvoicedSalePrices: vi.fn(
        async () =>
          new Map([["a", { hammerPence: 100_000, premiumPence: 20_000, pricingPolicyId: null }]]),
      ),
    };
    const out = await lotsWithCheckoutPricing(
      { saleService: { findByIds: vi.fn(async () => [sale]) } as never, invoicedSalePrices },
      [lot("a"), lot("b")],
    );
    expect(out.map((l) => l.checkoutPricing?.totalMajor)).toEqual(["1200.00", "1250.00"]);
    expect(invoicedSalePrices.findInvoicedSalePrices).toHaveBeenCalledTimes(1);
  });
});
