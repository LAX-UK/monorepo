import type { Bid } from "@auction/types";
import type { IBiddingPlaceBidHttpApplicationService } from "../interfaces/bidding-routes/bidding-place-bid-http.js";
import {
  type BiddingRouteOutcome,
  biddingRouteFromBidError,
} from "../interfaces/bidding-routes/bidding-route-http.js";
import type { IBidPlacerWithIdempotency } from "../interfaces/place-bid.js";

export class BiddingPlaceBidHttpApplicationService
  implements IBiddingPlaceBidHttpApplicationService
{
  constructor(private readonly bidPlacer: IBidPlacerWithIdempotency) {}

  async placeBid(
    input: Parameters<IBidPlacerWithIdempotency["placeBidWithIdempotency"]>[0],
  ): Promise<BiddingRouteOutcome<Bid>> {
    const out = await this.bidPlacer.placeBidWithIdempotency(input);
    if (out.type === "replay") {
      return { kind: "replay", data: out.body.data, status: 201 };
    }
    if (out.type === "err") {
      return biddingRouteFromBidError(out.error);
    }
    return { kind: "ok", data: out.body.data, status: 201 };
  }
}
