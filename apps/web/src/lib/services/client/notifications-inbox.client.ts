import { apiBaseUrl } from "@/lib/auth/api-base";
import { parseUserNotification } from "@/lib/data/http/parse";
import type { UserNotification } from "@auction/types";

import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";

const jsonHeaders = { "Content-Type": "application/json" } as const;

/** Client-side notifications inbox API (credentials: include). Used by {@link useNotificationsInbox}. */
export async function fetchNotificationsInboxPage(
  tab: InboxTab,
  type: string,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<{ ok: true; items: UserNotification[] } | { ok: false; error: string }> {
  const params = new URLSearchParams({
    tab,
    limit: String(limit),
    offset: String(offset),
  });
  const trimmedType = type.trim();
  if (trimmedType) params.set("type", trimmedType);
  try {
    const init: RequestInit = { credentials: "include" };
    if (signal) init.signal = signal;
    const res = await fetch(`${apiBaseUrl()}/users/me/notifications?${params}`, init);
    if (!res.ok) {
      return { ok: false, error: `Could not load notifications (${res.status}).` };
    }
    const body = (await res.json()) as { data: unknown[] };
    const items = body.data.map(parseUserNotification);
    return { ok: true, items };
  } catch (err) {
    if (signal?.aborted) return { ok: false, error: "Aborted" };
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not load notifications.",
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
    if (!res.ok) return { ok: false, error: `Could not mark as read (${res.status}).` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not mark as read" };
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
    if (!res.ok) return { ok: false, error: `Could not mark selection as read (${res.status}).` };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not mark selection as read",
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
    if (!res.ok) return { ok: false, error: `Could not mark all as read (${res.status}).` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not mark all as read" };
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
      return { ok: false, error: `Could not archive (${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not archive" };
  }
}
