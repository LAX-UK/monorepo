import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { parseNotificationPreference } from "@/lib/data/http/parse";
import type { NotificationPreference } from "@auction/types";

/** Current user's notification prefs (`GET /users/me/preferences/notifications`). */
export async function getServerMyNotificationPreferences(): Promise<NotificationPreference | null> {
  try {
    const res = await authedServerFetch("/users/me/preferences/notifications");
    if (!res.ok) return null;
    const json = (await res.json()) as { data: unknown };
    try {
      return parseNotificationPreference(json.data);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
