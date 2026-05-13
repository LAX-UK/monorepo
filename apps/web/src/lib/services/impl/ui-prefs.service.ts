import type { UiPreferencePatch } from "@auction/validators";
import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type { IUiPrefsService } from "../interfaces/ui-prefs-service";

export class UiPrefsService implements IUiPrefsService {
  constructor(private readonly api: IAuthedApiClient) {}

  async patch(prefs: UiPreferencePatch): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/users/me/preferences/ui", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
  }
}
