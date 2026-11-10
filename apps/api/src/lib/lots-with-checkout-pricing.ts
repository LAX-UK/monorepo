import type { Lot, PublicLotView, Sale } from "@auction/types";
import type { SaleLookupPort } from "../container/container-slices.js";
import { computeLotCheckoutPricing } from "./lot-checkout-pricing.js";

type LotsWithCheckoutPricingDeps = {
  saleService: SaleLookupPort;
};

/** Batch-load the sales the lots belong to, keyed by sale id. */
async function loadSalesForLots(
  container: LotsWithCheckoutPricingDeps,
  lots: readonly (Lot | PublicLotView)[],
): Promise<Map<string, Sale>> {
  const saleIds = [
    ...new Set(
      lots
        .map((l) => l.saleId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (saleIds.length === 0) return new Map();
  const saleRows = await container.saleService.findByIds(saleIds);
  return new Map(saleRows.map((s) => [s.id, s]));
}

/** Every lot payload names the zone its sale quotes times in; a lot without a sale names none. */
export function withSaleTimeZone<T extends Lot | PublicLotView>(
  lot: T,
  sale: Pick<Sale, "timeZone"> | null,
): T {
  return sale ? { ...lot, timeZone: sale.timeZone } : lot;
}

/** Batch-load sales and attach each lot's sale `timeZone`, for lists that carry no pricing. */
export async function lotsWithSaleTimeZone(
  container: LotsWithCheckoutPricingDeps,
  lots: (Lot | PublicLotView)[],
): Promise<(Lot | PublicLotView)[]> {
  if (lots.length === 0) return lots;
  const saleById = await loadSalesForLots(container, lots);
  return lots.map((lot) =>
    withSaleTimeZone(lot, lot.saleId ? (saleById.get(lot.saleId) ?? null) : null),
  );
}

/** Batch-load sales and attach `checkoutPricing` and `timeZone` for dashboard / list consumers. */
export async function lotsWithCheckoutPricing(
  container: LotsWithCheckoutPricingDeps,
  lots: (Lot | PublicLotView)[],
): Promise<(Lot | PublicLotView)[]> {
  if (lots.length === 0) return lots;
  const saleById = await loadSalesForLots(container, lots);
  return lots.map((lotRow) => {
    const sale = lotRow.saleId ? (saleById.get(lotRow.saleId) ?? null) : null;
    const priced = { ...lotRow, checkoutPricing: computeLotCheckoutPricing(lotRow, sale) };
    return withSaleTimeZone(priced, sale);
  });
}
