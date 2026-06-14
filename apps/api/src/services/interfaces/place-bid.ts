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
};

/** Narrow port for callers that only need to place bids (e.g. absentee replay). */
export interface IBidPlacer {
  placeBid(input: PlaceBidInput): Promise<Result<Bid, BidError>>;
}
