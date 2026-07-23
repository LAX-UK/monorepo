import type { ConditionReportRequestRow } from "@auction/persistence/interfaces";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export interface IBiddingConditionReportHttpApplicationService {
  findForBuyerOnLot(input: {
    userId: string;
    lotId: string;
  }): Promise<BiddingRouteOutcome<ConditionReportRequestRow | null>>;

  createRequest(input: {
    userId: string;
    lotId: string;
    requestNote?: string;
    actingLegalEntityId?: string | undefined;
    requestingLegalEntityId?: string | undefined;
  }): Promise<BiddingRouteOutcome<ConditionReportRequestRow>>;
}
