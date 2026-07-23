import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export interface IBiddingAbsenteeBidHttpApplicationService {
  scheduleAbsentee(input: {
    userId: string;
    lotId: string;
    actingLegalEntityId?: string | undefined;
    bodyLegalEntityId?: string | undefined;
    maxAmount: number;
  }): Promise<BiddingRouteOutcome<{ id: string }>>;
}
