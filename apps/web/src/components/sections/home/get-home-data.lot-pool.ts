import { allocateHomeLots } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";

export type HomePageLotsInput = {
  /**
   * The hang's candidates in hanging order (the lead sale's featured lots first, then its top
   * lots). The hang claims its lots before the rail, and stays empty when fewer than
   * `HOME_HANG_MIN_WORKS` can hang.
   */
  hangLots?: readonly Lot[];
  hangLimit?: number;
  /** The lead sale's lots in the order the rail should show them. */
  railLots?: readonly Lot[];
  railLimit: number;
  /** Fewest lots that make a rail; fewer and it stays empty and claims nothing. */
  railMin: number;
  /** The last sale's sold lots, best first, for the results band. */
  resultsLots?: readonly Lot[];
  resultsLimit: number;
  resultsMin: number;
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

/**
 * Every lot appears once on the page, by priority: the hero, the hang under it, the sale rail,
 * then the results band.
 */
export function allocateHomePageLots({
  hangLots = [],
  hangLimit = 0,
  railLots = [],
  railLimit,
  railMin,
  resultsLots = [],
  resultsLimit,
  resultsMin,
  heroLots = [],
}: HomePageLotsInput): {
  hang: Lot[];
  rail: Lot[];
  results: Lot[];
} {
  const slots = allocateHomeLots<Lot>([
    { key: "hero", candidates: heroLots, limit: heroLots.length },
    { key: "hang", candidates: hangLots, limit: hangLimit, min: HOME_HANG_MIN_WORKS },
    { key: "rail", candidates: railLots, limit: railLimit, min: railMin },
    { key: "results", candidates: resultsLots, limit: resultsLimit, min: resultsMin },
  ]);
  return { hang: slots.hang ?? [], rail: slots.rail ?? [], results: slots.results ?? [] };
}
