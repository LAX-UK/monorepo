import type { Bid } from "@auction/types";
import type { IBiddingPlaceBidHttpApplicationService } from "../interfaces/bidding-routes/bidding-place-bid-http.js";
import {
  type BiddingRouteOutcome,
  biddingRouteFromBidError,
} from "../interfaces/bidding-routes/bidding-route-http.js";
import type { IBidPlacerWithIdempotency } from "../interfaces/place-bid.js";
import type { IBidRefusalObserver } from "./bid-limit-refusal.notifier.js";

export class BiddingPlaceBidHttpApplicationService
  implements IBiddingPlaceBidHttpApplicationService
{
  constructor(
    private readonly bidPlacer: IBidPlacerWithIdempotency,
    /** Told about refused bids (for the bidding-limit notices); never delays the answer. */
    private readonly refusals: IBidRefusalObserver | null = null,
  ) {}

  async placeBid(
    input: Parameters<IBidPlacerWithIdempotency["placeBidWithIdempotency"]>[0],
  ): Promise<BiddingRouteOutcome<Bid>> {
    const out = await this.bidPlacer.placeBidWithIdempotency(input);
    if (out.type === "replay") {
      return { kind: "replay", data: out.body.data, status: 201 };
    }
    if (out.type === "err") {
      void this.refusals
        ?.refused({
          placedByUserId: input.placedByUserId,
          buyerLegalEntityId: input.buyerLegalEntityId,
          lotId: input.lotId,
          amount: Math.max(input.amount, input.maxAutoBidAmount ?? 0),
          error: out.error,
        })
        .catch(() => undefined);
      return biddingRouteFromBidError(out.error);
    }
    return { kind: "ok", data: out.body.data, status: 201 };
  }
}
