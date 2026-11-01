import type { LotViewerActor, LotViewerView } from "../lot-viewer-state.js";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export interface IBiddingLotViewerHttpApplicationService {
  /** Where the acting account stands on the lot; a 404 outcome when the lot does not exist. */
  getMine(input: {
    actor: LotViewerActor;
    lotId: string;
  }): Promise<BiddingRouteOutcome<LotViewerView>>;
}
