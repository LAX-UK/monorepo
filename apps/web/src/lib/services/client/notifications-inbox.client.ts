import { apiBaseUrl } from "@/lib/auth/api-base";
import { parseInboxNotification } from "@/lib/data/http/parse";
import { type InboxQuery, inboxApiParams } from "@/lib/notifications/inbox-query";
import type { UserNotificationListItem } from "@auction/types";

const jsonHeaders = { "Content-Type": "application/json" } as const;

/** Client-side notifications inbox API (credentials: include). Used by {@link useNotificationsInbox}. */
export async function fetchNotificationsInboxPage(
  query: InboxQuery,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<{ ok: true; items: UserNotificationListItem[] } | { ok: false; error: string }> {
  const params = inboxApiParams(query, offset, limit);
  try {
    const init: RequestInit = { credentials: "include" };
    if (signal) init.signal = signal;
    const res = await fetch(`${apiBaseUrl()}/users/me/notifications?${params}`, init);
    if (!res.ok) {
      return { ok: false, error: "We couldn't load your notifications." };
    }
    const body = (await res.json()) as { data: unknown[] };
    const items = body.data.map(parseInboxNotification);
    return { ok: true, items };
  } catch {
    if (signal?.aborted) return { ok: false, error: "Aborted" };
    return {
      ok: false,
      error: "We couldn't reach LAX Bid. Check your connection and try again.",
    };
  }
}

export async function patchNotificationRead(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/users/me/notifications/${encodeURIComponent(id)}/read`,
      {
        method: "PATCH",
        credentials: "include",
      },
    );
    if (!res.ok) return { ok: false, error: "We couldn't mark it as read. Try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't reach LAX Bid. Check your connection and try again." };
  }
}

export async function patchNotificationsReadBulk(
  ids: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${apiBaseUrl()}/users/me/notifications/read-bulk`, {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return { ok: false, error: "We couldn't mark those as read. Try again." };
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "We couldn't reach LAX Bid. Check your connection and try again.",
    };
  }
}

export async function patchNotificationsReadAll(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${apiBaseUrl()}/users/me/notifications/read-all`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) return { ok: false, error: "We couldn't mark everything as read. Try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't reach LAX Bid. Check your connection and try again." };
  }
}

export async function deleteNotification(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${apiBaseUrl()}/users/me/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok && res.status !== 204) {
      return { ok: false, error: "We couldn't archive it. Try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't reach LAX Bid. Check your connection and try again." };
  }
}

/** The numbers beside Needs action and Unread; `null` when they cannot be read. */
export async function fetchInboxCounts(
  account: InboxQuery["account"],
): Promise<{ needsAction: number; unread: number } | null> {
  const qs = account === "all" ? "" : `?account=${encodeURIComponent(account)}`;
  try {
    const res = await fetch(`${apiBaseUrl()}/users/me/notifications/counts${qs}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { needsAction?: number; unread?: number } };
    return {
      needsAction: Number(body.data?.needsAction ?? 0),
      unread: Number(body.data?.unread ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * "Don't notify me about Northbank Gallery" (`muted: true`), or hearing about it again. Notices
 * that carry money, a decision or security still arrive; the API decides which.
 */
export async function setOrganisationMuted(
  legalEntityId: string,
  muted: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/users/me/notification-mutes/${encodeURIComponent(legalEntityId)}`,
      { method: muted ? "PUT" : "DELETE", credentials: "include" },
    );
    if (!res.ok && res.status !== 204) {
      return {
        ok: false,
        error: muted
          ? "We couldn't stop these notifications. Try again."
          : "We couldn't turn these notifications back on. Try again.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't reach LAX Bid. Check your connection and try again." };
  }
}
