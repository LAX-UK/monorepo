import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type {
  INotificationPrefsService,
  NotificationPreferencePatch,
} from "../interfaces/notification-prefs-service";

export class NotificationPrefsService implements INotificationPrefsService {
  constructor(private readonly api: IAuthedApiClient) {}

  async patch(prefs: NotificationPreferencePatch): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/users/me/preferences/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
  }
}
