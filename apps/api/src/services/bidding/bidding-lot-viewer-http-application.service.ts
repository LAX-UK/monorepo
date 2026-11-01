import type { IBiddingLotViewerHttpApplicationService } from "../interfaces/bidding-routes/bidding-lot-viewer-http.js";
import type { BiddingRouteOutcome } from "../interfaces/bidding-routes/bidding-route-http.js";
import type {
  ILotViewerStateService,
  LotViewerActor,
  LotViewerView,
} from "../interfaces/lot-viewer-state.js";

export class BiddingLotViewerHttpApplicationService
  implements IBiddingLotViewerHttpApplicationService
{
  constructor(private readonly viewerState: ILotViewerStateService) {}

  async getMine(input: {
    actor: LotViewerActor;
    lotId: string;
  }): Promise<BiddingRouteOutcome<LotViewerView>> {
    const view = await this.viewerState.forLot(input);
    if (!view) return { kind: "err", error: { message: "Not found", status: 404 } };
    return { kind: "ok", data: view };
  }
}
