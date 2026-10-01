import type { EditionCustodyStatus } from "./edition-custody-state.js";
import type { EditionListingStatus } from "./edition-listing-state.js";

export type EditionLifecycleStatus =
  | "allocated"
  | "available"
  | "reserved"
  | "sold"
  | "in_production"
  | "stored"
  | "shipped"
  | "returned";

export type EditionSellabilityInput = {
  ownerPartyId: string | null;
  /** @deprecated Use listingStatus — kept for tests during migration */
  status?: EditionLifecycleStatus;
  listingStatus: EditionListingStatus;
  custodyStatus: EditionCustodyStatus;
  reservedUntil: Date | null;
  reservedByPendingOrder: boolean;
  now: Date;
};

const BLOCKED_CUSTODY: readonly EditionCustodyStatus[] = ["with_owner", "returned"];

export function isEditionSellable(input: EditionSellabilityInput): boolean {
  if (input.ownerPartyId === null) {
    return false;
  }
  if (BLOCKED_CUSTODY.includes(input.custodyStatus)) {
    return false;
  }
  if (input.listingStatus === "authorised") {
    return true;
  }
  if (
    input.listingStatus === "reserved" &&
    input.reservedUntil !== null &&
    input.reservedUntil < input.now &&
    !input.reservedByPendingOrder
  ) {
    return true;
  }
  return false;
}

export function countSellableEditions(
  editions: readonly EditionSellabilityInput[],
  now: Date,
): number {
  return editions.filter((row) => isEditionSellable({ ...row, now })).length;
}
