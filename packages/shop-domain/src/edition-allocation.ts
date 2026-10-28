import { LAX_STANDARD_RUN, type PlannedEdition, planEditionRun } from "./edition-run.js";

export {
  ARTIST_ALLOCATION_COUNT,
  BUYER_ENTITLEMENT_COUNT,
  LAX_ALLOCATION_COUNT,
  SHOP_EDITION_COUNT,
  assertValidEditionPlan,
  type EditionAllocationKind,
  type PlannedEdition,
} from "./edition-run.js";

/**
 * Builds the canonical 1–24 numbering and 10/10/4 allocation for eligible artwork. Kept for
 * callers that only know whether an artwork sells prints; new code passes a run to planEditionRun.
 */
export function planEditionsForArtwork(eligibleForEditionAllocation: boolean): PlannedEdition[] {
  return eligibleForEditionAllocation ? planEditionRun(LAX_STANDARD_RUN) : [];
}

/**
 * What the public may know about an edition run: its size and whether any edition is still
 * available. The remaining count is deliberately not returned.
 */
export function publicEditionAvailability(input: {
  eligibleForEditionAllocation: boolean;
  totalEditionCount: number;
  availableEditionCount: number;
}): { totalEditions: number; state: "available" | "sold_out" } {
  if (!input.eligibleForEditionAllocation) {
    return { totalEditions: 0, state: "available" };
  }
  return {
    totalEditions: input.totalEditionCount,
    state: input.availableEditionCount > 0 ? "available" : "sold_out",
  };
}
