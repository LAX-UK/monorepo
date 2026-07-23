import type { Bid } from "@auction/types";
import type { PlaceBidWithIdempotencyInput } from "../place-bid.js";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export interface IBiddingPlaceBidHttpApplicationService {
  placeBid(input: PlaceBidWithIdempotencyInput): Promise<BiddingRouteOutcome<Bid>>;
}
