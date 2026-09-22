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
  status: EditionLifecycleStatus;
  reservedUntil: Date | null;
  now: Date;
};

/** An edition is sellable when it has an owner who is due proceeds and stock is not held elsewhere. */
export function isEditionSellable(input: EditionSellabilityInput): boolean {
  if (input.ownerPartyId === null) {
    return false;
  }
  if (input.status === "available") {
    return true;
  }
  if (
    input.status === "reserved" &&
    input.reservedUntil !== null &&
    input.reservedUntil < input.now
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
