import { amountRefusal } from "@auction/domain";
import type { Lot } from "@auction/types";
import { BidError } from "./bid-error.js";

/**
 * The refusal for an amount the lot does not accept: typed, with the amount to use instead.
 * `message` stays the plain-language reason older clients show.
 */
export function amountRefusedError(
  message: string,
  lot: Pick<Lot, "auctionType" | "currentPrice" | "startingPrice" | "minBidIncrement">,
  seenNextBid?: string | null,
): BidError {
  const refusal = amountRefusal({ lot, seenNextBid });
  return new BidError(message, 400, refusal.code, refusal.details);
}
