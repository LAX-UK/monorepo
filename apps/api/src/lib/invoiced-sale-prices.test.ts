import type { InvoicedSalePrice } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { standardBuyerPremiumBands } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import { showsSoldResult, withInvoicedSalePrices } from "./invoiced-sale-prices.js";

const sale = {
  id: "s1",
  buyerPremiumRate: "0.2500",
  buyerPremiumTiers: standardBuyerPremiumBands(),
} as Sale;

const lot = (id: string, over: Partial<Lot> = {}) =>
  ({
    id,
    saleId: "s1",
    status: "ended",
    winnerId: "buyer",
    currentPrice: "600000.00",
    buyerPremiumRate: null,
    ...over,
  }) as Lot;

/** Raised before clause 11: 10% on the whole hammer. */
const invoiced: InvoicedSalePrice = {
  hammerPence: 60_000_000,
  premiumPence: 6_000_000,
  pricingPolicyId: "tiered:[0:0.1500,50000000:0.1000]",
};

function reader(prices: Record<string, InvoicedSalePrice>) {
  return {
    findInvoicedSalePrices: vi.fn(
      async (ids: readonly string[]) =>
        new Map(ids.flatMap((id) => (prices[id] ? [[id, prices[id]] as const] : []))),
    ),
  };
}

describe("showsSoldResult", () => {
  it.each([
    [{ status: "ended", winnerId: "u" }, true],
    [{ status: "ended", winnerId: null, hasWinner: true }, true],
    [{ status: "ended", winnerId: "u", resultPending: true }, false],
    [{ status: "ended", winnerId: null }, false],
    [{ status: "active", winnerId: "u" }, false],
  ] as const)("%o → %s", (fields, expected) => {
    expect(showsSoldResult({ id: "x", ...fields } as Lot)).toBe(expected);
  });
});

describe("withInvoicedSalePrices", () => {
  it("prices a sold, invoiced lot from its invoice, not under today's bands", async () => {
    const [priced] = await withInvoicedSalePrices(reader({ a: invoiced }), [lot("a")], () => sale);
    expect(priced?.checkoutPricing).toEqual({
      hammerMajor: "600000.00",
      premiumMajor: "60000.00",
      totalMajor: "660000.00",
      policyId: invoiced.pricingPolicyId,
      kind: "tiered",
    });
  });

  it("reads once for the whole list, asking only about lots that show as sold", async () => {
    const r = reader({ a: invoiced });
    const lots = [
      lot("a"),
      lot("b"),
      lot("pending", { resultPending: true }),
      lot("unsold", { winnerId: null }),
      lot("live", { status: "active" }),
    ];
    const out = await withInvoicedSalePrices(r, lots, () => sale);
    expect(r.findInvoicedSalePrices).toHaveBeenCalledTimes(1);
    expect(r.findInvoicedSalePrices).toHaveBeenCalledWith(["a", "b"]);
    // Lots without an invoice are returned untouched.
    expect(out.slice(1)).toEqual(lots.slice(1));
  });

  it("replaces a live figure the lot already carries", async () => {
    const live = { ...lot("a"), checkoutPricing: { totalMajor: "685000.00" } } as Lot;
    const [priced] = await withInvoicedSalePrices(reader({ a: invoiced }), [live], () => sale);
    expect(priced?.checkoutPricing?.totalMajor).toBe("660000.00");
  });

  it("changes nothing without a reader", async () => {
    const lots = [lot("a")];
    expect(await withInvoicedSalePrices(null, lots, () => sale)).toEqual(lots);
  });
});
