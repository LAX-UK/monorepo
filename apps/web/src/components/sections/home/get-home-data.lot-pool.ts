import { isPublicLotStatus } from "@/lib/catalog/public-catalog-visibility";
import { allocateHomeLots } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";
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
  /** Lots staff featured for the lead sale, in staff order; they lead the rail. */
  featuredLotIds?: readonly string[];
  /**
   * The hang's candidates in hanging order (the lead sale's featured lots first, then its top
   * lots). The hang claims its lots before the rail and "More lots", and stays empty when fewer
   * than `HOME_HANG_MIN_WORKS` can hang.
   */
  hangLots?: readonly Lot[];
  hangLimit?: number;
  /** The lots the hero shows or credits. They are placed first, so nothing below repeats them. */
  heroLots?: readonly Lot[];
};

/** The hang needs two works with photographs: one is already the hero's work. */
export const HOME_HANG_MIN_WORKS = 2;

/** Sale ids pinned to the home page, in `homePinOrder`. */
export function homePinnedSaleIds(
  sales: ReadonlyArray<Pick<Sale, "id" | "homePinOrder">>,
): string[] {
  return sales
    .filter((s): s is typeof s & { homePinOrder: number } => typeof s.homePinOrder === "number")
    .sort((a, b) => a.homePinOrder - b.homePinOrder)
    .map((s) => s.id);
}

/** The pool lots staff featured, in staff order; unknown ids are skipped. */
function featuredLots(pool: Lot[], featuredLotIds: readonly string[]): Lot[] {
  const byId = new Map(pool.map((lot) => [lot.id, lot]));
  return featuredLotIds.flatMap((id) => byId.get(id) ?? []);
}

/**
 * Every lot appears once on the page, by priority: the hero, the hang under it, the sale rail, then
 * "More lots", which is empty (so the section is hidden) when fewer than
 * `HOME_MORE_LOTS_MIN` unseen lots remain.
 */
export function allocateHomePageLots({
  railLots,
  pool,
  moreLimit,
  featuredLotIds = [],
  hangLots = [],
  hangLimit = 0,
  heroLots = [],
}: HomePageLotsInput): {
  hang: Lot[];
  rail: Lot[];
  more: Lot[];
} {
  const slots = allocateHomeLots<Lot>([
    { key: "hero", candidates: heroLots, limit: heroLots.length },
    { key: "hang", candidates: hangLots, limit: hangLimit, min: HOME_HANG_MIN_WORKS },
    {
      key: "rail",
      candidates: [...featuredLots(pool, featuredLotIds), ...railLots],
      limit: railLots.length,
    },
    { key: "more", candidates: pool, limit: moreLimit, min: HOME_MORE_LOTS_MIN },
  ]);
  return { hang: slots.hang ?? [], rail: slots.rail ?? [], more: slots.more ?? [] };
}
