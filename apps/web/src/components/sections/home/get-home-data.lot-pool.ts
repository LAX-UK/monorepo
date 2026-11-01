import { isPublicLotStatus } from "@/lib/catalog/public-catalog-visibility";
import type { Lot } from "@auction/types";
import { HOME_MORE_LOTS_MIN } from "./get-home-data.constants";

/** Merge active + scheduled lots for the lower home strip; active order preserved first. */
export function buildHomeCatalogLotPool(activeLots: Lot[], scheduledLots: Lot[]): Lot[] {
  const seen = new Set<string>();
  const merged: Lot[] = [];
  for (const lot of [...activeLots, ...scheduledLots]) {
    if (!isPublicLotStatus(lot.status) || seen.has(lot.id)) continue;
    seen.add(lot.id);
    merged.push(lot);
  }
  return merged;
}

export type HomeMoreLotsInput = {
  pool: Lot[];
  /** Lots already shown higher up the page (for example the live or upcoming rail). */
  shownLotIds: ReadonlySet<string>;
  limit: number;
};

/**
 * Lots for the "More lots" strip: never a lot already shown on the page, and
 * empty (so the section is hidden) when fewer than `HOME_MORE_LOTS_MIN` remain.
 */
export function pickHomeMoreLots({ pool, shownLotIds, limit }: HomeMoreLotsInput): Lot[] {
  const unique = pool.filter((lot) => !shownLotIds.has(lot.id));
  return unique.length >= HOME_MORE_LOTS_MIN ? unique.slice(0, limit) : [];
}
