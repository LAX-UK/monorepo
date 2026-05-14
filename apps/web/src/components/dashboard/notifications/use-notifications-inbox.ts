"use client";

import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { NOTIFICATIONS_PAGE_SIZE } from "@/components/dashboard/notifications/notifications-inbox.constants";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import {
  deleteNotification,
  fetchNotificationsInboxPage,
  patchNotificationRead,
  patchNotificationsReadAll,
  patchNotificationsReadBulk,
} from "@/lib/services/client/notifications-inbox.api";
import { notify } from "@/lib/ui/notify";
import type { UserNotification } from "@auction/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
export { NOTIFICATIONS_PAGE_SIZE } from "@/components/dashboard/notifications/notifications-inbox.constants";

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
  /** First page from SSR when URL tab/type match (skips duplicate fetch on first paint). */
  initialPage?: {
    tab: InboxTab;
    type: string;
    items: UserNotification[];
    hasMore: boolean;
  };
};

type BulkResult = { fulfilled: number; rejected: number };

/** Single source of truth for the notifications inbox: list fetching,
 * pagination, mutations, real-time merging, and retry.
 *
 * Reads use {@link fetchNotificationsInboxPage}; writes use the same client API module.
 */
export function useNotificationsInbox({
  tab,
  type,
  onRealtimeArrival,
  initialPage,
}: UseNotificationsInboxOptions) {
  const [state, setState] = useState<FetchState>(() =>
    initialPage
      ? {
          items: initialPage.items,
          loading: false,
          loadingMore: false,
          hasMore: initialPage.hasMore,
          error: null,
        }
      : INITIAL_STATE,
  );
  const requestSeqRef = useRef(0);
  const itemCountRef = useRef(0);
  const onArrivalRef = useRef(onRealtimeArrival);
  onArrivalRef.current = onRealtimeArrival;
  const skipFirstListFetchRef = useRef(
    Boolean(initialPage && initialPage.tab === tab && initialPage.type === type),
  );

  const fetchPage = useCallback(
    async (offset: number, append: boolean, signal?: AbortSignal): Promise<void> => {
      const seq = ++requestSeqRef.current;
      const result = await fetchNotificationsInboxPage(
        tab,
        type,
        offset,
        NOTIFICATIONS_PAGE_SIZE,
        signal,
      );
      if (seq !== requestSeqRef.current) return;
      if (signal?.aborted) return;
      if (!result.ok) {
        setState((prev) => ({
          ...prev,
          items: append ? prev.items : [],
          loading: false,
          loadingMore: false,
          hasMore: false,
          error: result.error,
        }));
        return;
      }
      const page = result.items;
      setState((prev) => ({
        ...prev,
        items: append ? [...prev.items, ...page] : page,
        loading: false,
        loadingMore: false,
        hasMore: page.length === NOTIFICATIONS_PAGE_SIZE,
        error: null,
      }));
    },
    [tab, type],
  );

  useEffect(() => {
    itemCountRef.current = state.items.length;
  }, [state.items.length]);

  useEffect(() => {
    const controller = new AbortController();
    if (skipFirstListFetchRef.current) {
      skipFirstListFetchRef.current = false;
      return () => controller.abort();
    }
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
    const result = await patchNotificationRead(id);
    if (!result.ok) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((n) => (n.id === id ? { ...n, read: false } : n)),
      }));
      notify.error(result.error);
      return false;
    }
    return true;
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
    const result = await patchNotificationsReadBulk([...ids]);
    if (!result.ok) {
      setState((prev) => ({ ...prev, items: previous }));
      notify.error(result.error);
      return { fulfilled: 0, rejected: ids.length };
    }
    return { fulfilled: ids.length, rejected: 0 };
  }, []);

  const markAllRead = useCallback(async (): Promise<boolean> => {
    let previous: UserNotification[] = [];
    setState((prev) => {
      previous = prev.items;
      return { ...prev, items: prev.items.map((n) => ({ ...n, read: true })) };
    });
    const result = await patchNotificationsReadAll();
    if (!result.ok) {
      setState((prev) => ({ ...prev, items: previous }));
      notify.error(result.error);
      return false;
    }
    return true;
  }, []);

  const archive = useCallback(async (id: string): Promise<boolean> => {
    let previous: UserNotification[] = [];
    setState((prev) => {
      previous = prev.items;
      return { ...prev, items: prev.items.filter((n) => n.id !== id) };
    });
    const result = await deleteNotification(id);
    if (!result.ok) {
      setState((prev) => ({ ...prev, items: previous }));
      notify.error(result.error);
      return false;
    }
    return true;
  }, []);

  const archiveMany = useCallback(async (ids: ReadonlyArray<string>): Promise<BulkResult> => {
    if (ids.length === 0) return { fulfilled: 0, rejected: 0 };
    const idSet = new Set(ids);
    let previous: UserNotification[] = [];
    setState((prev) => {
      previous = prev.items;
      return { ...prev, items: prev.items.filter((n) => !idSet.has(n.id)) };
    });
    const results = await Promise.allSettled(ids.map((id) => deleteNotification(id)));
    const failedIds = new Set<string>();
    let fulfilled = 0;
    for (let i = 0; i < results.length; i += 1) {
      const r = results[i];
      const id = ids[i];
      if (r && r.status === "fulfilled" && r.value.ok) {
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
