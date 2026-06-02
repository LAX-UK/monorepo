import type { HeroStateVM } from "@/components/sections/home/home-view-models";
import { isPublicLotStatus } from "@/lib/catalog/public-catalog-visibility";
import type { Lot } from "@auction/types";
import { HOME_PRIVATE_HIGHLIGHTS_LIMIT } from "./get-home-data.constants";
import type { HomeUrgencySection } from "./get-home-data.types";

/** Merge active + scheduled lots for lower home strips; active order preserved first. */
export function buildHomeCatalogLotPool(activeLots: Lot[], scheduledLots: Lot[]): Lot[] {
  const seen = new Set<string>();
  const merged: Lot[] = [];
  for (const lot of activeLots) {
    if (!isPublicLotStatus(lot.status) || seen.has(lot.id)) continue;
    seen.add(lot.id);
    merged.push(lot);
  }
  for (const lot of scheduledLots) {
    if (!isPublicLotStatus(lot.status) || seen.has(lot.id)) continue;
    seen.add(lot.id);
    merged.push(lot);
  }
  return merged;
}

/** Prefer lots past the editor’s-picks window; fall back to the tail so thin
 * catalogues still surface a distinct row when possible. */
export function pickPrivateSaleHighlightLots(lots: Lot[]): Lot[] {
  if (lots.length === 0) return [];
  const fromOffset = lots.slice(12, 15);
  if (fromOffset.length > 0) return fromOffset;
  return lots.slice(-Math.min(HOME_PRIVATE_HIGHLIGHTS_LIMIT, lots.length));
}

export type HomeLowerStripPickInput = {
  pool: Lot[];
  heroState: HeroStateVM;
  urgencySection: HomeUrgencySection;
};

type PickOpts = {
  /** When true, ignore ending-soon urgency exclusions (second pass). */
  relaxEndingSoonExclusion?: boolean;
};

/** Candidates for Editor's Picks / Private Sale — hero- and urgency-aware, with fallback. */
export function pickHomeLowerStripCandidates(
  input: HomeLowerStripPickInput,
  opts: PickOpts = {},
): Lot[] {
  const excludeIds = new Set<string>();

  if (input.heroState.kind === "fallbackLot" && input.heroState.lot.id !== "placeholder") {
    excludeIds.add(input.heroState.lot.id);
  }

  if (!opts.relaxEndingSoonExclusion && input.urgencySection.variant === "endingSoon") {
    for (const vm of input.urgencySection.lots) {
      excludeIds.add(vm.id);
    }
  }

  const candidates = input.pool.filter((lot) => !excludeIds.has(lot.id));

  if (candidates.length === 0 && input.pool.length > 0 && !opts.relaxEndingSoonExclusion) {
    return pickHomeLowerStripCandidates(input, { relaxEndingSoonExclusion: true });
  }

  return candidates;
}
