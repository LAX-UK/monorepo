import type { PlaceBidWithIdempotencyOutcome } from "@auction/bidding-runtime";
import type { Bid } from "@auction/types";
import type { Result } from "neverthrow";
import type { BidError } from "../../lib/errors.js";

export type PlaceBidPlacement = {
  placedVia?: string;
  telephoneBookingId?: string;
  clerkUserId?: string;
  /** Saleroom paddle bid: sale + paddle for eligibility cap lookup. */
  saleId?: string;
  paddleNumber?: number;
};

/** Single canonical input for bid placement (no legacy positional overload). */
export type PlaceBidInput = {
  placedByUserId: string;
  buyerLegalEntityId: string;
  lotId: string;
  amount: number;
  maxAutoBidAmount?: number;
  autoBidStepAmount?: number;
  placement?: PlaceBidPlacement;
  /** Durable idempotency for internal replays (e.g. absentee). */
  internalPlacementKey?: string;
};

/** Narrow port for callers that only need to place bids (e.g. absentee replay). */
export interface IBidPlacer {
  placeBid(input: PlaceBidInput): Promise<Result<Bid, BidError>>;
}

export type PlaceBidWithIdempotencyInput = {
  placedByUserId: string;
  buyerLegalEntityId?: string;
  idempotencyKey?: string;
  lotId: string;
  amount: number;
  maxAutoBidAmount?: number;
  autoBidStepAmount?: number;
  placedVia?: string;
  telephoneBookingId?: string;
  clerkUserId?: string;
  saleId?: string;
  paddleNumber?: number;
};

/** Narrow port for HTTP/auto-bid callers that need idempotent placement. */
export interface IBidPlacerWithIdempotency extends IBidPlacer {
  placeBidWithIdempotency(
    input: PlaceBidWithIdempotencyInput,
  ): Promise<PlaceBidWithIdempotencyOutcome>;
}
