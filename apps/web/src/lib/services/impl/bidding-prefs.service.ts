import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type {
  BiddingPreferencesPatch,
  IBiddingPrefsService,
} from "../interfaces/bidding-prefs-service";

export class BiddingPrefsService implements IBiddingPrefsService {
  constructor(private readonly api: IAuthedApiClient) {}

  async patch(prefs: BiddingPreferencesPatch): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/users/me/bidding-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
  }
}
