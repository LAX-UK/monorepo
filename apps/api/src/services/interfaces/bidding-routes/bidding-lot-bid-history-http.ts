import type { PublicBidHistory } from "@auction/domain";
import type { StaffRoles, UserRole } from "@auction/types";
import type { ListBidsForPublicApiResult } from "../../lot/lot-types.js";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export type LotBidHistoryHttpData = Extract<ListBidsForPublicApiResult, { kind: "ok" }>["data"];

export interface IBiddingLotBidHistoryHttpApplicationService {
  listForLot(input: {
    lotId: string;
    viewerRole: UserRole;
    viewerStaffRoles?: StaffRoles | undefined;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<BiddingRouteOutcome<LotBidHistoryHttpData> | { kind: "not_found" }>;

  /** The anonymised history anyone may read: amount, channel, time, "you", and the total. */
  listPublicForLot(input: {
    lotId: string;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<BiddingRouteOutcome<PublicBidHistory> | { kind: "not_found" }>;
}
