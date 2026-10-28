import type { EditionCustodyStatus } from "./edition-custody-state.js";
import { assertAuthorityWithinOwnership } from "./edition-run.js";
import { ShopDomainError } from "./shop-domain-error.js";

/** One print an owner holds in a run, identified by its stock reference (numbered or not). */
export type EditionAuthorityRow = {
  stockRef: number;
  listingStatus: "not_authorised" | "authorised" | "reserved" | "held" | "sold" | "withdrawn";
  custodyStatus: EditionCustodyStatus;
};

const BLOCKED_CUSTODY_FOR_AUTHORITY: readonly EditionAuthorityRow["custodyStatus"][] = [
  "with_owner",
  "returned",
];

const TAKEN: readonly EditionAuthorityRow["listingStatus"][] = [
  "reserved",
  "held",
  "sold",
  "withdrawn",
];

/**
 * How many of an owner's prints can be on sale at once: every print they hold that is not sold,
 * reserved, held for a client or withdrawn. This is the cap on sale authority (rule 14).
 */
export function authorisablePrintCount(rows: readonly EditionAuthorityRow[]): number {
  return rows.filter((row) => !TAKEN.includes(row.listingStatus)).length;
}

/** Lowest stock references first for new authority, so numbered runs sell in number order. */
export function selectEditionsToAuthorise(
  freeEditions: readonly EditionAuthorityRow[],
  count: number,
): number[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new ShopDomainError("Authority count must be a whole number, 0 or more");
  }
  const eligible = freeEditions
    .filter(
      (e) =>
        e.listingStatus === "not_authorised" &&
        !BLOCKED_CUSTODY_FOR_AUTHORITY.includes(e.custodyStatus),
    )
    .sort((a, b) => a.stockRef - b.stockRef);
  return eligible.slice(0, count).map((e) => e.stockRef);
}

/** Highest stock references first when authority is reduced. */
export function selectEditionsToRevokeAuthority(
  freeEditions: readonly EditionAuthorityRow[],
  revokeCount: number,
): number[] {
  const authorised = freeEditions
    .filter((e) => e.listingStatus === "authorised")
    .sort((a, b) => b.stockRef - a.stockRef);
  return authorised.slice(0, revokeCount).map((e) => e.stockRef);
}

/**
 * `newAuthorisedCount` is the target number of prints on sale and not yet taken. It is capped at
 * the prints the owner holds that could be on sale (`authorisablePrintCount`), not a fixed number.
 */
export function assertAuthorityReductionAllowed(input: {
  newAuthorisedCount: number;
  authorisableCount: number;
}): void {
  if (input.newAuthorisedCount < 0) {
    throw new ShopDomainError("Authority count cannot be negative");
  }
  assertAuthorityWithinOwnership(input.newAuthorisedCount, input.authorisableCount);
}
