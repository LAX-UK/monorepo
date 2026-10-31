"use client";

import { useAccountChrome } from "@/components/layout/account-switcher/account-chrome-context";
import { useListQuery } from "@/components/workspace/use-list-query";
import { type InboxQuery, inboxSearch } from "@/lib/notifications/inbox-query";
import {
  type InboxAccounts,
  type InboxRowView,
  inboxRowView,
} from "@/lib/notifications/inbox-row.vm";
import {
  fetchInboxCounts,
  setOrganisationMuted,
} from "@/lib/services/client/notifications-inbox.client";
import { notify } from "@/lib/ui/notify";
import type { UserNotification, UserNotificationListItem } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DateBand, groupByDateBand } from "./notification-presenters";
import { useNotificationsInbox } from "./use-notifications-inbox";

export type InboxCounts = { needsAction: number; unread: number };

export type InboxBoardInput = {
  query: InboxQuery;
  initialPage: { query: InboxQuery; items: UserNotificationListItem[]; hasMore: boolean } | null;
  counts: InboxCounts | null;
  mutedIds: readonly string[];
};

/** The accounts the person uses, from the shell's switcher. */
function useInboxAccounts(): InboxAccounts {
  const chrome = useAccountChrome();
  return useMemo(() => {
    const options = chrome?.switcher?.options ?? (chrome ? [chrome.current] : []);
    return {
      currentId: chrome?.current.id ?? "",
      options: options.map(({ id, kind, name, initials }) => ({ id, kind, name, initials })),
    };
  }, [chrome]);
}

/**
 * The Notifications page's state: the query in the address, the list for it as rows, the view
 * counts, the picked rows, the muted organisations, and every action on one row or several.
 */
export function useNotificationsInboxBoard(input: InboxBoardInput) {
  const router = useRouter();
  const accounts = useInboxAccounts();
  const { query, setQuery, search, setSearch } = useListQuery(input.query, inboxSearch);
  const [counts, setCounts] = useState<InboxCounts | null>(input.counts);
  const [muted, setMuted] = useState<ReadonlySet<string>>(() => new Set(input.mutedIds));
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [liveMessage, setLiveMessage] = useState("");
  const liveTimer = useRef<number | null>(null);

  const announce = useCallback((message: string) => {
    setLiveMessage(message);
    if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(() => setLiveMessage(""), 4000);
  }, []);
  useEffect(
    () => () => {
      if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
    },
    [],
  );

  const refreshCounts = useCallback(async () => {
    const next = await fetchInboxCounts(query.account);
    if (next) setCounts(next);
  }, [query.account]);

  // Counts follow the account picked; the first ones came with the page.
  const countsAccount = useRef(input.query.account);
  useEffect(() => {
    if (countsAccount.current === query.account) return;
    countsAccount.current = query.account;
    void refreshCounts();
  }, [query.account, refreshCounts]);

  const inbox = useNotificationsInbox({
    query,
    onRealtimeArrival: useCallback(
      (n: UserNotification) => {
        announce(`New notification: ${n.title}`);
        void refreshCounts();
      },
      [announce, refreshCounts],
    ),
    ...(input.initialPage ? { initialPage: input.initialPage } : {}),
  });

  // A pick only holds rows still on the page.
  useEffect(() => {
    const ids = new Set(inbox.items.map((item) => item.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [inbox.items]);

  const rows = useMemo(
    () => inbox.items.map((item) => inboxRowView(item, accounts, muted)),
    [inbox.items, accounts, muted],
  );
  const groups = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    return groupByDateBand(inbox.items).map(({ band, items }) => ({
      band: band as DateBand,
      rows: items.flatMap((item) => byId.get(item.id) ?? []),
    }));
  }, [inbox.items, rows]);

  const after = useCallback(
    async (done: Promise<unknown>) => {
      await done;
      void refreshCounts();
    },
    [refreshCounts],
  );

  const markRead = useCallback(
    (row: InboxRowView) => void after(inbox.markRead(row.id)),
    [after, inbox],
  );

  const archive = useCallback(
    async (row: InboxRowView) => {
      if (await inbox.archive(row.id)) announce("Notification archived");
      void refreshCounts();
    },
    [announce, inbox, refreshCounts],
  );

  const opened = useCallback(
    (row: InboxRowView) => {
      if (row.unread) void inbox.markRead(row.id);
    },
    [inbox],
  );

  const navigate = useCallback(
    (row: InboxRowView) => {
      if (!row.href) return;
      opened(row);
      // The switch hop is a server route: load it in full rather than through the client router.
      if (row.viaHop) window.location.assign(row.href);
      else router.push(row.href);
    },
    [opened, router],
  );

  const setMute = useCallback(async (row: InboxRowView, mute: boolean, undoable = true) => {
    if (!row.mute) return;
    const { legalEntityId, name } = row.mute;
    const apply = (on: boolean) =>
      setMuted((current) => {
        const next = new Set(current);
        if (on) next.add(legalEntityId);
        else next.delete(legalEntityId);
        return next;
      });
    apply(mute);
    const result = await setOrganisationMuted(legalEntityId, mute);
    if (!result.ok) {
      apply(!mute);
      notify.error(result.error);
      return;
    }
    if (!undoable) return;
    if (mute) {
      notify.action(`You won't be notified about ${name}`, {
        description: "Payments, wins and requests that need you still reach you.",
        id: `mute-${legalEntityId}`,
        onAction: () =>
          void setMute({ ...row, mute: { legalEntityId, name, muted: true } }, false, false),
      });
    } else {
      notify.success(`You'll be notified about ${name} again`, { id: `mute-${legalEntityId}` });
    }
  }, []);

  const toggleSelect = useCallback((id: string, on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const markAllRead = useCallback(async () => {
    if (await inbox.markAllRead()) notify.success("All notifications marked as read");
    void refreshCounts();
  }, [inbox, refreshCounts]);

  const bulkMarkRead = useCallback(async () => {
    const ids = [...selected];
    const { fulfilled } = await inbox.markReadMany(ids);
    if (fulfilled > 0) announce(`${fulfilled} marked as read`);
    clearSelection();
    void refreshCounts();
  }, [announce, clearSelection, inbox, refreshCounts, selected]);

  const bulkArchive = useCallback(async () => {
    const ids = [...selected];
    const { fulfilled, rejected } = await inbox.archiveMany(ids);
    if (rejected > 0) {
      notify.error(`Archived ${fulfilled} of ${ids.length}`, {
        description: "Some couldn't be archived. Try those again.",
      });
    } else {
      announce(`${fulfilled} archived`);
    }
    clearSelection();
    void refreshCounts();
  }, [announce, clearSelection, inbox, refreshCounts, selected]);

  return {
    accounts,
    query,
    setQuery,
    search,
    setSearch,
    counts,
    rows,
    groups,
    selected,
    toggleSelect,
    clearSelection,
    liveMessage,
    markRead,
    archive,
    opened,
    navigate,
    setMute,
    markAllRead,
    bulkMarkRead,
    bulkArchive,
    loading: inbox.loading,
    loadingMore: inbox.loadingMore,
    hasMore: inbox.hasMore,
    error: inbox.error,
    loadMore: inbox.loadMore,
    retry: inbox.retry,
  };
}
