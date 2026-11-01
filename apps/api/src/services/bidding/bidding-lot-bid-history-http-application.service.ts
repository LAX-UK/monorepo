import type { PublicBidHistory } from "@auction/domain";
import type { StaffRoles, UserRole } from "@auction/types";
import type {
  IBiddingLotBidHistoryHttpApplicationService,
  LotBidHistoryHttpData,
} from "../interfaces/bidding-routes/bidding-lot-bid-history-http.js";
import type { BiddingRouteOutcome } from "../interfaces/bidding-routes/bidding-route-http.js";
import type { ILotService } from "../interfaces/lot-service.js";

export class BiddingLotBidHistoryHttpApplicationService
  implements IBiddingLotBidHistoryHttpApplicationService
{
  constructor(private readonly lotService: ILotService) {}

  async listForLot(input: {
    lotId: string;
    viewerRole: UserRole;
    viewerStaffRoles?: StaffRoles | undefined;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<BiddingRouteOutcome<LotBidHistoryHttpData> | { kind: "not_found" }> {
    const result = await this.lotService.listBidsForPublicApi({
      lotId: input.lotId,
      viewerRole: input.viewerRole,
      viewerStaffRoles: input.viewerStaffRoles,
      viewerId: input.viewerId,
      limitQuery: input.limitQuery,
    });
    if (result.kind === "not_found") {
      return { kind: "not_found" };
    }
    return { kind: "ok", data: result.data };
  }

  async listPublicForLot(input: {
    lotId: string;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<BiddingRouteOutcome<PublicBidHistory> | { kind: "not_found" }> {
    const result = await this.lotService.listPublicBidHistory(input);
    if (result.kind === "not_found") return { kind: "not_found" };
    return { kind: "ok", data: result.data };
  }
}
