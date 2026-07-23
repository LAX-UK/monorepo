import type { Bid } from "@auction/types";
import type { AutoBidSettings } from "../../auto-bid.service.js";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export interface IBiddingAutoBidHttpApplicationService {
  getAutoBid(input: {
    lotId: string;
    placedByUserId: string;
  }): Promise<BiddingRouteOutcome<AutoBidSettings | null>>;

  setAutoBid(input: {
    lotId: string;
    placedByUserId: string;
    actingLegalEntityId?: string | undefined;
    maxAutoBidAmount: number;
    autoBidStepAmount: number;
    idempotencyKey?: string;
  }): Promise<BiddingRouteOutcome<Bid | AutoBidSettings>>;

  clearAutoBid(input: {
    lotId: string;
    placedByUserId: string;
  }): Promise<BiddingRouteOutcome<{ cleared: number }>>;
}
