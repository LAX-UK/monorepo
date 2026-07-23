/**
 * Bid orchestration now lives in @auction/bidding-runtime (DIP: the placement
 * pipeline, eligibility gates, and idempotency executor are package-owned and
 * composed around narrow ports). This module stays as a thin re-export so
 * existing apps/api imports keep working.
 */
export { BidService, type BidServiceOptions } from "@auction/bidding-runtime";
export type { PlaceBidWithIdempotencyOutcome } from "@auction/bidding-runtime";
export type { LotJobSchedulerPort } from "./bid/bid-policy.js";
