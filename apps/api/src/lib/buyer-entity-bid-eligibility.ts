import type { LegalEntityStatus } from "@auction/types";

/** Buyer-side bidding only needs a verified identity, not finished Stripe payout setup. */
const BUYER_BID_ELIGIBLE_STATUSES = new Set<LegalEntityStatus>([
  "approved",
  "restricted",
  "connect_pending",
]);

/** Whether a legal entity status allows placing bids (buyer side). */
export function buyerEntityCanBid(status: LegalEntityStatus): boolean {
  return BUYER_BID_ELIGIBLE_STATUSES.has(status);
}
