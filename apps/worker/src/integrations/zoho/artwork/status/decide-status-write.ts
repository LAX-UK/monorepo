/** The Zoho Products Status picklist values LAX knows. Zoho staff may set others. */
export const ZOHO_STATUS = {
  available: "Available",
  reserved: "Reserved",
  inAuction: "In Auction",
  sold: "Sold",
  withdrawn: "Withdrawn",
} as const;

export type StatusDecision =
  /** Zoho already shows the Status LAX wants. */
  | { kind: "in_sync" }
  /** Zoho shows nothing staff set that LAX would lose: send the Status. */
  | { kind: "write" }
  /** Zoho shows a value LAX did not write: leave it, and tell staff. */
  | { kind: "conflict"; zohoStatus: string };

/**
 * Compare-and-set for the Zoho Status. Zoho Products is the source of truth for inventory, so LAX
 * only replaces a Status it can account for:
 *
 * - the Status LAX wants is already there: nothing to send;
 * - Zoho shows no Status, the one LAX last wrote, or Available (the neutral value): send it;
 * - anything else is staff's: a Sold or Reserved set by hand, or a value LAX has never written.
 *   Nothing is sent and the difference is raised as a conflict.
 *
 * Pure: the same inputs always give the same decision.
 */
export function decideStatusWrite(input: {
  /** What LAX would set, from where the artwork is. */
  wanted: string;
  /** What the Zoho Product shows now, read just before; null when it shows none. */
  zohoStatus: string | null;
  /** What LAX last wrote to the Product; null when it never has. */
  lastWritten: string | null;
}): StatusDecision {
  const { wanted, zohoStatus, lastWritten } = input;
  if (zohoStatus === wanted) return { kind: "in_sync" };
  if (zohoStatus === null) return { kind: "write" };
  if (zohoStatus === ZOHO_STATUS.available || zohoStatus === lastWritten) return { kind: "write" };
  return { kind: "conflict", zohoStatus };
}
