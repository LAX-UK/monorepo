import type { Lot, PublicLotView, Sale } from "@auction/types";
import type { SaleLookupPort } from "../container/container-slices.js";
import { computeLotCheckoutPricing } from "./lot-checkout-pricing.js";
import { type WithSaleZone, loadSalesForLots, withSaleTimeZone } from "./lot-sale-time-zone.js";

type LotsWithCheckoutPricingDeps = {
  saleService: SaleLookupPort;
};

/** Batch-load sales and attach `checkoutPricing` and the sale's `timeZone` for dashboard and list consumers. */
export async function lotsWithCheckoutPricing(
  container: LotsWithCheckoutPricingDeps,
  lots: (Lot | PublicLotView)[],
): Promise<WithSaleZone<Lot | PublicLotView>[]> {
  if (lots.length === 0) return lots;
  const saleById: Map<string, Sale> = await loadSalesForLots(container, lots);
  return lots.map((lotRow) => {
    const sale = lotRow.saleId ? (saleById.get(lotRow.saleId) ?? null) : null;
    const priced = { ...lotRow, checkoutPricing: computeLotCheckoutPricing(lotRow, sale) };
    return withSaleTimeZone(priced, sale);
  });
}
