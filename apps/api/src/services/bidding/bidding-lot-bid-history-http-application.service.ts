import type { UserRole } from "@auction/types";
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
    viewerStaffRole?: string | null;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<BiddingRouteOutcome<LotBidHistoryHttpData> | { kind: "not_found" }> {
    const result = await this.lotService.listBidsForPublicApi({
      lotId: input.lotId,
      viewerRole: input.viewerRole,
      viewerStaffRole: input.viewerStaffRole ?? null,
      viewerId: input.viewerId,
      limitQuery: input.limitQuery,
    });
    if (result.kind === "not_found") {
      return { kind: "not_found" };
    }
    return { kind: "ok", data: result.data };
  }
}
