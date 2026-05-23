import "server-only";
import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
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
  /** Optional type filter (API `type` query). */
  type?: string;
};

async function fetchMyNotifications(
  params: ListMyNotificationsParams = {},
): Promise<UserNotification[]> {
  const { limit = 10, offset = 0, tab = "all", type } = params;
  const qs = new URLSearchParams({
    tab,
    limit: String(limit),
    offset: String(offset),
  });
  const trimmedType = type?.trim();
  if (trimmedType) qs.set("type", trimmedType);
  const res = await authedServerFetch(`/users/me/notifications?${qs.toString()}`);
  await throwIfNotOk(res, "notifications");
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseUserNotification);
}

/** Throws {@link DashboardFetchError} on failure — use on dedicated inbox routes. */
export async function getServerMyNotifications(
  params: ListMyNotificationsParams = {},
): Promise<UserNotification[]> {
  return fetchMyNotifications(params);
}

/** Soft-fail variant for overview partial-success (empty list + flag). */
export async function getServerMyNotificationsSafe(
  params: ListMyNotificationsParams = {},
): Promise<{ items: UserNotification[]; failed: boolean }> {
  try {
    const items = await fetchMyNotifications(params);
    return { items, failed: false };
  } catch {
    return { items: [], failed: true };
  }
}
