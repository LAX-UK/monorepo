import type { LotViewerActor } from "../lot-viewer-state.js";
import type { UserHttpJson } from "./user-route-http.js";

export interface IUserLotStatesHttpApplicationService {
  /**
   * How the acting account stands on each of the lots, for card state lines. Only lots the
   * account has bid on appear in the answer.
   */
  list(input: { actor: LotViewerActor; lotIds: readonly string[] }): Promise<UserHttpJson>;
}
