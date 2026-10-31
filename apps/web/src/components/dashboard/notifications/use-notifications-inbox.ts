"use client";

import { NOTIFICATIONS_PAGE_SIZE } from "@/components/dashboard/notifications/notifications-inbox.constants";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { parseInboxNotification } from "@/lib/data/http/parse";
import { type InboxQuery, inboxSearch } from "@/lib/notifications/inbox-query";
import {
  deleteNotification,
  fetchNotificationsInboxPage,
  patchNotificationRead,
  patchNotificationsReadAll,
  patchNotificationsReadBulk,
} from "@/lib/services/client/notifications-inbox.client";
import { notify } from "@/lib/ui/notify";
import type { UserNotification, UserNotificationListItem } from "@auction/types";
import { useCallback, useEffect, useRef, useState } from "react";

type FetchState = {
  items: UserNotificationListItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
};

const LOADING: FetchState = {
  items: [],
  loading: true,
  loadingMore: false,
  hasMore: false,
  error: null,
};

type Options = {
  query: InboxQuery;
  /** Fired when a notification arrives while the page is open. */
  onRealtimeArrival?: (n: UserNotification) => void;
  /** The first page from the server for this query (skips a second read on first paint). */
  initialPage?: { query: InboxQuery; items: UserNotificationListItem[]; hasMore: boolean };
};

type BulkResult = { fulfilled: number; rejected: number };
type Result = { ok: true } | { ok: false; error: string };

/** Re-parse server items so dates are Dates after the server/client boundary. */
function hydrate(items: UserNotificationListItem[]): UserNotificationListItem[] {
  return items.map((item) => parseInboxNotification(item));
}

/** Each view keeps only what belongs in it once something is read or archived. */
function stillInView(query: InboxQuery, item: UserNotificationListItem): boolean {
  if (query.tab === "unread" || query.tab === "needs_action") return !item.read;
  return true;
}

/**
 * The inbox's list for one query: the pages read so far, reading more, and the changes made to
 * one notification or several, applied at once and undone if the API refuses them.
 */
export function useNotificationsInbox({ query, onRealtimeArrival, initialPage }: Options) {
  const key = inboxSearch(query);
  const [state, setState] = useState<FetchState>(() =>
    initialPage && inboxSearch(initialPage.query) === key
      ? {
          items: hydrate(initialPage.items),
          loading: false,
          loadingMore: false,
          hasMore: initialPage.hasMore,
          error: null,
        }
      : LOADING,
  );
  const seq = useRef(0);
  const countRef = useRef(state.items.length);
  const arrival = useRef(onRealtimeArrival);
  arrival.current = onRealtimeArrival;
  const skipFirst = useRef(Boolean(initialPage && inboxSearch(initialPage.query) === key));
  const queryRef = useRef(query);
  queryRef.current = query;

  const fetchPage = useCallback(async (offset: number, append: boolean, signal?: AbortSignal) => {
    const mine = ++seq.current;
    const result = await fetchNotificationsInboxPage(
      queryRef.current,
      offset,
      NOTIFICATIONS_PAGE_SIZE,
      signal,
    );
    if (mine !== seq.current || signal?.aborted) return;
    setState((prev) =>
      result.ok
        ? {
            items: append ? [...prev.items, ...result.items] : result.items,
            loading: false,
            loadingMore: false,
            hasMore: result.items.length === NOTIFICATIONS_PAGE_SIZE,
            error: null,
          }
        : {
            ...prev,
            items: append ? prev.items : [],
            loading: false,
            loadingMore: false,
            hasMore: false,
            error: result.error,
          },
    );
  }, []);

  useEffect(() => {
    countRef.current = state.items.length;
  }, [state.items.length]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the address key is the query.
  useEffect(() => {
    const controller = new AbortController();
    if (skipFirst.current) {
      skipFirst.current = false;
      return () => controller.abort();
    }
    setState(LOADING);
    void fetchPage(0, false, controller.signal);
    return () => controller.abort();
  }, [key, fetchPage]);

  const loadMore = useCallback(async () => {
    let go = false;
    setState((prev) => {
      if (!prev.hasMore || prev.loadingMore || prev.loading) return prev;
      go = true;
      return { ...prev, loadingMore: true };
    });
    if (go) await fetchPage(countRef.current, true);
  }, [fetchPage]);

  const retry = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    await fetchPage(0, false);
  }, [fetchPage]);

  // A new notification may belong to any view or account: read the first page again.
  useUserNotifications({
    enabled: !state.loading,
    onNotification: useCallback(
      (n: UserNotification) => {
        void fetchPage(0, false);
        arrival.current?.(n);
      },
      [fetchPage],
    ),
  });

  /** Applies a change at once, and puts the list back if the API refuses it. */
  const optimistic = useCallback(
    async (
      change: (items: UserNotificationListItem[]) => UserNotificationListItem[],
      send: () => Promise<Result>,
    ): Promise<boolean> => {
      let previous: UserNotificationListItem[] = [];
      setState((prev) => {
        previous = prev.items;
        return { ...prev, items: change(prev.items) };
      });
      const result = await send();
      if (!result.ok) {
        setState((prev) => ({ ...prev, items: previous }));
        notify.error(result.error);
        return false;
      }
      return true;
    },
    [],
  );

  const markReadWhere = useCallback(
    (match: (item: UserNotificationListItem) => boolean) => (items: UserNotificationListItem[]) =>
      items
        .map((n) => (match(n) ? { ...n, read: true, needsAction: false } : n))
        .filter((n) => stillInView(queryRef.current, n)),
    [],
  );

  const markRead = useCallback(
    (id: string) =>
      optimistic(
        markReadWhere((n) => n.id === id),
        () => patchNotificationRead(id),
      ),
    [markReadWhere, optimistic],
  );

  const markReadMany = useCallback(
    async (ids: ReadonlyArray<string>): Promise<BulkResult> => {
      if (ids.length === 0) return { fulfilled: 0, rejected: 0 };
      const set = new Set(ids);
      const ok = await optimistic(
        markReadWhere((n) => set.has(n.id)),
        () => patchNotificationsReadBulk([...ids]),
      );
      return ok ? { fulfilled: ids.length, rejected: 0 } : { fulfilled: 0, rejected: ids.length };
    },
    [markReadWhere, optimistic],
  );

  const markAllRead = useCallback(
    () =>
      optimistic(
        markReadWhere(() => true),
        () => patchNotificationsReadAll(),
      ),
    [markReadWhere, optimistic],
  );

  const archive = useCallback(
    (id: string) =>
      optimistic(
        (items) => items.filter((n) => n.id !== id),
        () => deleteNotification(id),
      ),
    [optimistic],
  );

  const archiveMany = useCallback(async (ids: ReadonlyArray<string>): Promise<BulkResult> => {
    if (ids.length === 0) return { fulfilled: 0, rejected: 0 };
    const set = new Set(ids);
    let previous: UserNotificationListItem[] = [];
    setState((prev) => {
      previous = prev.items;
      return { ...prev, items: prev.items.filter((n) => !set.has(n.id)) };
    });
    const results = await Promise.allSettled(ids.map((id) => deleteNotification(id)));
    const failed = new Set(
      ids.filter((_, i) => {
        const r = results[i];
        return !(r && r.status === "fulfilled" && r.value.ok);
      }),
    );
    if (failed.size > 0) {
      setState((prev) => {
        const present = new Set(prev.items.map((n) => n.id));
        const back = previous.filter((n) => failed.has(n.id) && !present.has(n.id));
        const merged = [...prev.items, ...back].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );
        return { ...prev, items: merged };
      });
    }
    return { fulfilled: ids.length - failed.size, rejected: failed.size };
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
