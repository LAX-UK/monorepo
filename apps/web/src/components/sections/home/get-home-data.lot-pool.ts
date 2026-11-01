import { isPublicLotStatus } from "@/lib/catalog/public-catalog-visibility";
import { allocateHomeLots } from "@auction/domain";
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

export type HomePageLotsInput = {
  /** Lots the sale rail already chose, in display order. */
  railLots: Lot[];
  pool: Lot[];
  moreLimit: number;
};

/**
 * Every lot appears once on the page, by priority: the sale rail first, then
 * "More lots", which is empty (so the section is hidden) when fewer than
 * `HOME_MORE_LOTS_MIN` unseen lots remain.
 */
export function allocateHomePageLots({ railLots, pool, moreLimit }: HomePageLotsInput): {
  rail: Lot[];
  more: Lot[];
} {
  const slots = allocateHomeLots<Lot>([
    { key: "rail", candidates: railLots, limit: railLots.length },
    { key: "more", candidates: pool, limit: moreLimit, min: HOME_MORE_LOTS_MIN },
  ]);
  return { rail: slots.rail ?? [], more: slots.more ?? [] };
}
