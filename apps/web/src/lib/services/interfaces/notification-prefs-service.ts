import type { notificationPreferencePatchSchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type NotificationPreferencePatch = z.infer<typeof notificationPreferencePatchSchema>;

export interface INotificationPrefsService {
  patch(prefs: NotificationPreferencePatch): Promise<ServiceResult<Record<string, unknown>>>;
}
