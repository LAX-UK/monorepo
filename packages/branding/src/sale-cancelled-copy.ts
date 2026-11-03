/** How a person was involved in a sale that was cancelled. */
export type SaleCancelledAudience = "bidder" | "consignor" | "other";

const CONSEQUENCE: Record<SaleCancelledAudience, string> = {
  bidder: "Your bids are void.",
  consignor: "Your lots in it are withdrawn.",
  other: "Its lots are no longer for sale.",
};

/** What a cancelled sale means for this person; the email and the in-app notice share it. */
export function saleCancelledConsequence(audience: SaleCancelledAudience): string {
  return CONSEQUENCE[audience];
}
