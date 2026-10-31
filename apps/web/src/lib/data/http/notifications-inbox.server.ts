import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import {
  parseInboxNotification,
  parseNotificationAccountMute,
} from "@/lib/data/http/parse/notifications.parse";
import { type InboxQuery, inboxApiParams } from "@/lib/notifications/inbox-query";
import type { NotificationAccountMute, UserNotificationListItem } from "@auction/types";

/** The numbers beside the inbox's Needs action and Unread views. */
export type InboxCounts = { needsAction: number; unread: number };

async function readData(res: Response): Promise<unknown> {
  if (!res.ok) throw new Error(`inbox_read_failed_${res.status}`);
  const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return body?.data;
}

/** One page of the inbox for a query. Throws when it cannot be read. */
export async function getServerInboxPage(
  query: InboxQuery,
  limit: number,
): Promise<UserNotificationListItem[]> {
  const res = await authedServerFetch(
    `/users/me/notifications?${inboxApiParams(query, 0, limit)}`,
    {
      cache: "no-store",
    },
  );
  const data = await readData(res);
  return Array.isArray(data) ? data.map(parseInboxNotification) : [];
}

/** The view counts, for every account or the one picked; `null` when they cannot be read. */
export async function getServerInboxCounts(
  account: InboxQuery["account"],
): Promise<InboxCounts | null> {
  const qs = account === "all" ? "" : `?account=${encodeURIComponent(account)}`;
  try {
    const data = (await readData(
      await authedServerFetch(`/users/me/notifications/counts${qs}`, { cache: "no-store" }),
    )) as Partial<InboxCounts> | undefined;
    return {
      needsAction: Number(data?.needsAction ?? 0),
      unread: Number(data?.unread ?? 0),
    };
  } catch {
    return null;
  }
}

/** The organisations the person muted; `null` when they cannot be read. */
export async function getServerNotificationMutes(): Promise<NotificationAccountMute[] | null> {
  try {
    const data = await readData(
      await authedServerFetch("/users/me/notification-mutes", { cache: "no-store" }),
    );
    return Array.isArray(data)
      ? data.flatMap((row) => {
          const mute = parseNotificationAccountMute(row);
          return mute ? [mute] : [];
        })
      : [];
  } catch {
    return null;
  }
}
