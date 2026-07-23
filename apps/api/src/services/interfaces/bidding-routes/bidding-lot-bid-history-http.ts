import type { UserRole } from "@auction/types";
import type { ListBidsForPublicApiResult } from "../../lot/lot-types.js";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export type LotBidHistoryHttpData = Extract<ListBidsForPublicApiResult, { kind: "ok" }>["data"];

export interface IBiddingLotBidHistoryHttpApplicationService {
  listForLot(input: {
    lotId: string;
    viewerRole: UserRole;
    viewerStaffRole?: string | null;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<BiddingRouteOutcome<LotBidHistoryHttpData> | { kind: "not_found" }>;
}
