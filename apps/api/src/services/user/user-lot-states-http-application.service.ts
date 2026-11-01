import type { ILotViewerStateService, LotViewerActor } from "../interfaces/lot-viewer-state.js";
import type { IUserLotStatesHttpApplicationService } from "../interfaces/user-routes/user-lot-states-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";

export class UserLotStatesHttpApplicationService implements IUserLotStatesHttpApplicationService {
  constructor(private readonly viewerState: ILotViewerStateService) {}

  async list(input: {
    actor: LotViewerActor;
    lotIds: readonly string[];
  }): Promise<UserHttpJson> {
    const data = await this.viewerState.forLots(input);
    return { status: 200, body: { data } };
  }
}
