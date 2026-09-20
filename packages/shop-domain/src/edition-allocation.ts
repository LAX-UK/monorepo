import { ShopDomainError } from "./shop-domain-error.js";

export const SHOP_EDITION_COUNT = 24 as const;
export const BUYER_ENTITLEMENT_COUNT = 10 as const;
export const ARTIST_ALLOCATION_COUNT = 10 as const;
export const LAX_ALLOCATION_COUNT = 4 as const;

export type EditionAllocationKind = "original_buyer_entitlement" | "artist" | "lax";

export type PlannedEdition = {
  editionNumber: number;
  allocation: EditionAllocationKind;
};

/** Builds the canonical 1–24 numbering and 10/10/4 allocation for eligible artwork. */
export function planEditionsForArtwork(eligibleForEditionAllocation: boolean): PlannedEdition[] {
  if (!eligibleForEditionAllocation) {
    return [];
  }
  const plan: PlannedEdition[] = [];
  for (let editionNumber = 1; editionNumber <= BUYER_ENTITLEMENT_COUNT; editionNumber++) {
    plan.push({ editionNumber, allocation: "original_buyer_entitlement" });
  }
  for (
    let editionNumber = BUYER_ENTITLEMENT_COUNT + 1;
    editionNumber <= BUYER_ENTITLEMENT_COUNT + ARTIST_ALLOCATION_COUNT;
    editionNumber++
  ) {
    plan.push({ editionNumber, allocation: "artist" });
  }
  for (
    let editionNumber = BUYER_ENTITLEMENT_COUNT + ARTIST_ALLOCATION_COUNT + 1;
    editionNumber <= SHOP_EDITION_COUNT;
    editionNumber++
  ) {
    plan.push({ editionNumber, allocation: "lax" });
  }
  return plan;
}

export function assertValidEditionPlan(plan: PlannedEdition[]): void {
  if (plan.length === 0) {
    return;
  }
  if (plan.length !== SHOP_EDITION_COUNT) {
    throw new ShopDomainError(`Expected ${SHOP_EDITION_COUNT} editions, got ${plan.length}`);
  }
  const numbers = plan.map((row) => row.editionNumber).sort((a, b) => a - b);
  for (let i = 0; i < SHOP_EDITION_COUNT; i++) {
    if (numbers[i] !== i + 1) {
      throw new ShopDomainError("Edition numbers must be exactly 1–24");
    }
  }
  const counts = plan.reduce(
    (acc, row) => {
      acc[row.allocation] += 1;
      return acc;
    },
    {
      original_buyer_entitlement: 0,
      artist: 0,
      lax: 0,
    } satisfies Record<EditionAllocationKind, number>,
  );
  if (counts.original_buyer_entitlement !== BUYER_ENTITLEMENT_COUNT) {
    throw new ShopDomainError("Invalid buyer entitlement allocation count");
  }
  if (counts.artist !== ARTIST_ALLOCATION_COUNT) {
    throw new ShopDomainError("Invalid artist allocation count");
  }
  if (counts.lax !== LAX_ALLOCATION_COUNT) {
    throw new ShopDomainError("Invalid LAX allocation count");
  }
}

export function publicEditionAvailability(input: {
  eligibleForEditionAllocation: boolean;
  totalEditionCount: number;
  availableEditionCount: number;
}): { totalEditions: number; editionsAvailable: number } {
  if (!input.eligibleForEditionAllocation) {
    return { totalEditions: 0, editionsAvailable: 0 };
  }
  return {
    totalEditions: input.totalEditionCount,
    editionsAvailable: input.availableEditionCount,
  };
}
