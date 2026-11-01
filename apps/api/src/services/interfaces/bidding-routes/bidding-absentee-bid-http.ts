import type { LegalEntityMemberRole } from "@auction/types";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export interface IBiddingAbsenteeBidHttpApplicationService {
  scheduleAbsentee(input: {
    userId: string;
    lotId: string;
    actingLegalEntityId?: string | undefined;
    bodyLegalEntityId?: string | undefined;
    memberRole?: LegalEntityMemberRole | undefined;
    maxAmount: number;
  }): Promise<BiddingRouteOutcome<{ id: string }>>;
}
