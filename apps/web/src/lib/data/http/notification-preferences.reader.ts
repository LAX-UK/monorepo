import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { notificationPreferenceSchema } from "@/lib/data/http/notifications.schema";
import type { NotificationPreference } from "@auction/types";

/** Current user's notification prefs (`GET /users/me/preferences/notifications`). */
export async function getServerMyNotificationPreferences(): Promise<NotificationPreference | null> {
  try {
    const res = await authedServerFetch("/users/me/preferences/notifications");
    if (!res.ok) return null;
    const body = await readJsonBody(res);
    try {
      return readDataEnvelope(
        body,
        notificationPreferenceSchema,
        "GET /users/me/preferences/notifications",
      );
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
