import type { Lot, PublicLotView, Sale } from "@auction/types";
import type { SaleLookupPort } from "../container/container-slices.js";

type SaleLookup = { saleService: SaleLookupPort };

/** The lot as the API sends it, naming the zone its sale quotes times in. */
export type WithSaleZone<T> = T & { timeZone?: string };

/** Batch-load the sales the lots belong to, keyed by sale id. */
export async function loadSalesForLots(
  container: SaleLookup,
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
): WithSaleZone<T> {
  return sale ? { ...lot, timeZone: sale.timeZone } : lot;
}

/** Batch-load sales and attach each lot's sale `timeZone`, for lists that carry no pricing. */
export async function lotsWithSaleTimeZone(
  container: SaleLookup,
  lots: (Lot | PublicLotView)[],
): Promise<WithSaleZone<Lot | PublicLotView>[]> {
  if (lots.length === 0) return lots;
  const saleById = await loadSalesForLots(container, lots);
  return lots.map((lot) =>
    withSaleTimeZone(lot, lot.saleId ? (saleById.get(lot.saleId) ?? null) : null),
  );
}
