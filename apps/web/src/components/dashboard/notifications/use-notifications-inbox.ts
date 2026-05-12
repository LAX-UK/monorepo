"use client";

import { useUserNotifications } from "@/hooks/use-user-notifications";
import { apiBaseUrl } from "@/lib/auth/api-base";
import { parseUserNotification } from "@/lib/data/http/parse";
import { notify } from "@/lib/ui/notify";
import type { UserNotification } from "@auction/types";
import { useCallback, useEffect, useRef, useState } from "react";

/** URL-driven tabs for the notifications inbox. */
export type InboxTab = "all" | "unread" | "archived";

export const NOTIFICATIONS_PAGE_SIZE = 25;

type FetchState = {
  items: UserNotification[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
};

const INITIAL_STATE: FetchState = {
  items: [],
  loading: true,
  loadingMore: false,
  hasMore: true,
  error: null,
};

type UseNotificationsInboxOptions = {
  tab: InboxTab;
  /** Empty string ⇒ no filter. */
  type: string;
  /** Optional callback fired when a new notification arrives via Socket.IO. */
  onRealtimeArrival?: (n: UserNotification) => void;
};

type BulkResult = { fulfilled: number; rejected: number };

/** Single source of truth for the notifications inbox: list fetching,
 * pagination, mutations, real-time merging, and retry.
 *
 * The hook intentionally keeps the network-base resolution inside (via
 * `apiBaseUrl()`) and exposes only typed operations so components depend on
 * this hook, not on `fetch` (DIP).
 */
export function useNotificationsInbox({
  tab,
  type,
  onRealtimeArrival,
}: UseNotificationsInboxOptions) {
  const [state, setState] = useState<FetchState>(INITIAL_STATE);
  const requestSeqRef = useRef(0);
  const itemCountRef = useRef(0);
  const onArrivalRef = useRef(onRealtimeArrival);
  onArrivalRef.current = onRealtimeArrival;

  const fetchPage = useCallback(
    async (offset: number, append: boolean, signal?: AbortSignal): Promise<void> => {
      const seq = ++requestSeqRef.current;
      const params = new URLSearchParams({
        tab,
        limit: String(NOTIFICATIONS_PAGE_SIZE),
        offset: String(offset),
      });
      const trimmedType = type.trim();
      if (trimmedType) params.set("type", trimmedType);
      try {
        const init: RequestInit = { credentials: "include" };
        if (signal) init.signal = signal;
        const res = await fetch(`${apiBaseUrl()}/users/me/notifications?${params}`, init);
        if (seq !== requestSeqRef.current) return;
        if (!res.ok) {
          setState((prev) => ({
            ...prev,
            items: append ? prev.items : [],
            loading: false,
            loadingMore: false,
            hasMore: false,
            error: `Could not load notifications (${res.status}).`,
          }));
          return;
        }
        const body = (await res.json()) as { data: unknown[] };
        const page = body.data.map(parseUserNotification);
        setState((prev) => ({
          ...prev,
          items: append ? [...prev.items, ...page] : page,
          loading: false,
          loadingMore: false,
          hasMore: page.length === NOTIFICATIONS_PAGE_SIZE,
          error: null,
        }));
      } catch (err) {
        if (signal?.aborted) return;
        if (seq !== requestSeqRef.current) return;
        setState((prev) => ({
          ...prev,
          items: append ? prev.items : [],
          loading: false,
          loadingMore: false,
          hasMore: false,
          error: err instanceof Error ? err.message : "Could not load notifications.",
        }));
      }
    },
    [tab, type],
  );

  useEffect(() => {
    itemCountRef.current = state.items.length;
  }, [state.items.length]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ ...INITIAL_STATE });
    itemCountRef.current = 0;
    void fetchPage(0, false, controller.signal);
    return () => controller.abort();
  }, [fetchPage]);

  const loadMore = useCallback(async (): Promise<void> => {
    let shouldFetch = false;
    setState((prev) => {
      if (!prev.hasMore || prev.loadingMore || prev.loading) return prev;
      shouldFetch = true;
      return { ...prev, loadingMore: true };
    });
    if (!shouldFetch) return;
    await fetchPage(itemCountRef.current, true);
  }, [fetchPage]);

  const retry = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    await fetchPage(0, false);
  }, [fetchPage]);

  useUserNotifications({
    enabled: !state.loading,
    onNotification: useCallback((n: UserNotification) => {
      setState((prev) => {
        const idx = prev.items.findIndex((x) => x.id === n.id);
        if (idx >= 0) {
          const next = [...prev.items];
          next[idx] = n;
          return { ...prev, items: next };
        }
        return { ...prev, items: [n, ...prev.items] };
      });
      onArrivalRef.current?.(n);
    }, []),
  });

  const markRead = useCallback(async (id: string): Promise<boolean> => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    try {
      const res = await fetch(
        `${apiBaseUrl()}/users/me/notifications/${encodeURIComponent(id)}/read`,
        { method: "PATCH", credentials: "include" },
      );
      if (!res.ok) throw new Error(`Could not mark as read (${res.status}).`);
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((n) => (n.id === id ? { ...n, read: false } : n)),
      }));
      notify.error(err instanceof Error ? err.message : "Could not mark as read");
      return false;
    }
  }, []);

  const markReadMany = useCallback(async (ids: ReadonlyArray<string>): Promise<BulkResult> => {
    if (ids.length === 0) return { fulfilled: 0, rejected: 0 };
    const idSet = new Set(ids);
    let previous: UserNotification[] = [];
    setState((prev) => {
      previous = prev.items;
      return {
        ...prev,
        items: prev.items.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n)),
      };
    });
    try {
      const res = await fetch(`${apiBaseUrl()}/users/me/notifications/read-bulk`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...ids] }),
      });
      if (!res.ok) throw new Error(`Could not mark selection as read (${res.status}).`);
      return { fulfilled: ids.length, rejected: 0 };
    } catch (err) {
      setState((prev) => ({ ...prev, items: previous }));
      notify.error(err instanceof Error ? err.message : "Could not mark selection as read");
      return { fulfilled: 0, rejected: ids.length };
    }
  }, []);

  const markAllRead = useCallback(async (): Promise<boolean> => {
    let previous: UserNotification[] = [];
    setState((prev) => {
      previous = prev.items;
      return { ...prev, items: prev.items.map((n) => ({ ...n, read: true })) };
    });
    try {
      const res = await fetch(`${apiBaseUrl()}/users/me/notifications/read-all`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Could not mark all as read (${res.status}).`);
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, items: previous }));
      notify.error(err instanceof Error ? err.message : "Could not mark all as read");
      return false;
    }
  }, []);

  const archive = useCallback(async (id: string): Promise<boolean> => {
    let previous: UserNotification[] = [];
    setState((prev) => {
      previous = prev.items;
      return { ...prev, items: prev.items.filter((n) => n.id !== id) };
    });
    try {
      const res = await fetch(`${apiBaseUrl()}/users/me/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error(`Could not archive (${res.status}).`);
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, items: previous }));
      notify.error(err instanceof Error ? err.message : "Could not archive");
      return false;
    }
  }, []);

  const archiveMany = useCallback(async (ids: ReadonlyArray<string>): Promise<BulkResult> => {
    if (ids.length === 0) return { fulfilled: 0, rejected: 0 };
    const idSet = new Set(ids);
    let previous: UserNotification[] = [];
    setState((prev) => {
      previous = prev.items;
      return { ...prev, items: prev.items.filter((n) => !idSet.has(n.id)) };
    });
    const base = apiBaseUrl();
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`${base}/users/me/notifications/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        }).then((res) => {
          if (!res.ok && res.status !== 204) {
            throw new Error(`Archive failed (${res.status})`);
          }
          return id;
        }),
      ),
    );
    const failedIds = new Set<string>();
    let fulfilled = 0;
    for (let i = 0; i < results.length; i += 1) {
      const r = results[i];
      const id = ids[i];
      if (r && r.status === "fulfilled") {
        fulfilled += 1;
      } else if (id !== undefined) {
        failedIds.add(id);
      }
    }
    if (failedIds.size > 0) {
      const restored = previous.filter((n) => failedIds.has(n.id));
      setState((prev) => {
        const present = new Set(prev.items.map((n) => n.id));
        const merged = [...prev.items];
        for (const n of restored) {
          if (!present.has(n.id)) merged.push(n);
        }
        merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return { ...prev, items: merged };
      });
    }
    return { fulfilled, rejected: failedIds.size };
  }, []);

  return {
    items: state.items,
    loading: state.loading,
    loadingMore: state.loadingMore,
    hasMore: state.hasMore,
    error: state.error,
    loadMore,
    retry,
    markRead,
    markReadMany,
    markAllRead,
    archive,
    archiveMany,
  };
}

export type NotificationsInbox = ReturnType<typeof useNotificationsInbox>;
