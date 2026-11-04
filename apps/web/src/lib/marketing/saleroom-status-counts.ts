import type { SaleroomCatalogStatus } from "@/lib/marketing/marketing-status-filters";
import type { Lot } from "@auction/types";

export type SaleroomStatusCounts = Record<Exclude<SaleroomCatalogStatus, "all">, number>;

const STATUS_OF_LOT: Partial<Record<Lot["status"], keyof SaleroomStatusCounts>> = {
  active: "live",
  scheduled: "upcoming",
  ended: "ended",
};

/**
 * Lots per status for the lot-status options, with the search applied but not the status itself,
 * so each option says how many lots choosing it would give. The sale's lots are counted in memory,
 * so this answers only when the page holds every lot of the sale; otherwise it returns null and
 * the options show no counts rather than counts for one page.
 */
export function countSaleroomStatuses(
  lots: readonly Lot[],
  options: { catalogSearch: string; holdsWholeCatalogue: boolean },
): SaleroomStatusCounts | null {
  if (!options.holdsWholeCatalogue) return null;
  const needle = options.catalogSearch.trim().toLowerCase();
  const counts: SaleroomStatusCounts = { live: 0, upcoming: 0, ended: 0 };
  const seen = new Set<string>();
  for (const lot of lots) {
    if (seen.has(lot.id)) continue;
    seen.add(lot.id);
    if (needle && !lot.title.toLowerCase().includes(needle)) continue;
    const status = STATUS_OF_LOT[lot.status];
    if (status) counts[status] += 1;
  }
  return counts;
}
