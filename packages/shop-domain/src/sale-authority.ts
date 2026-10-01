import type { EditionCustodyStatus } from "./edition-custody-state.js";
import { ShopDomainError } from "./shop-domain-error.js";

export type EditionAuthorityRow = {
  editionNumber: number;
  listingStatus: "not_authorised" | "authorised" | "reserved" | "held" | "sold" | "withdrawn";
  custodyStatus: EditionCustodyStatus;
};

const BLOCKED_CUSTODY_FOR_AUTHORITY: readonly EditionAuthorityRow["custodyStatus"][] = [
  "with_owner",
  "returned",
];

/** Pick lowest edition numbers first for new authority; highest first when revoking. */
export function selectEditionsToAuthorise(
  freeEditions: readonly EditionAuthorityRow[],
  count: number,
): number[] {
  if (count < 0 || count > 10) {
    throw new ShopDomainError("Authority count must be 0–10");
  }
  const eligible = freeEditions
    .filter(
      (e) =>
        e.listingStatus === "not_authorised" &&
        !BLOCKED_CUSTODY_FOR_AUTHORITY.includes(e.custodyStatus),
    )
    .sort((a, b) => a.editionNumber - b.editionNumber);
  return eligible.slice(0, count).map((e) => e.editionNumber);
}

export function selectEditionsToRevokeAuthority(
  freeEditions: readonly EditionAuthorityRow[],
  revokeCount: number,
): number[] {
  const authorised = freeEditions
    .filter((e) => e.listingStatus === "authorised")
    .sort((a, b) => b.editionNumber - a.editionNumber);
  return authorised.slice(0, revokeCount).map((e) => e.editionNumber);
}

/** `newAuthorisedCount` is the target count of free (listing authorised) editions only. */
export function assertAuthorityReductionAllowed(input: {
  newAuthorisedCount: number;
}): void {
  if (input.newAuthorisedCount < 0) {
    throw new ShopDomainError("Authority count cannot be negative");
  }
  if (input.newAuthorisedCount > 10) {
    throw new ShopDomainError("Authority count must be at most 10");
  }
}
