import type { OfferLockOutcome } from "@auction/artwork-register-contracts";

export type BidOfferLockEvent = { eventType: string; aggregateId: string; payload: unknown };

/** Applies a Bid lot event to the artwork register's one-place-at-a-time lock. */
export interface BidOfferLockApplier {
  apply(event: BidOfferLockEvent): Promise<OfferLockOutcome | { status: "ignored" }>;
}
