import "server-only";
import { parseUserNotification } from "@/lib/data/http/parse";
import type { UserNotification } from "@auction/types";

import { authedServerFetch } from "./authed-fetch.server";

export type ListMyNotificationsParams = {
  /** Default: 10. */
  limit?: number;
  /** Default: 0. */
  offset?: number;
  /** Inbox tab. Default: "all". */
  tab?: "all" | "unread" | "archived";
};

/** Server-side fetcher for the current user's notifications (SSR friendly).
 *
 * Returns an empty list on any failure so dashboards can render without throwing.
 */
export async function getServerMyNotifications(
  params: ListMyNotificationsParams = {},
): Promise<UserNotification[]> {
  const { limit = 10, offset = 0, tab = "all" } = params;
  const qs = new URLSearchParams({
    tab,
    limit: String(limit),
    offset: String(offset),
  });
  try {
    const res = await authedServerFetch(`/users/me/notifications?${qs.toString()}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { data: unknown[] };
    return body.data.map(parseUserNotification);
  } catch {
    return [];
  }
}
