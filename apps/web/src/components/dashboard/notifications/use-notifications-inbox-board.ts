"use client";

import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { useNotificationsInbox } from "@/components/dashboard/notifications/use-notifications-inbox";
import {
  buildNotificationsHref,
  parseNotificationsParams,
} from "@/lib/dashboard/filters/notifications/notifications-filters";
import { notify } from "@/lib/ui/notify";
import type { UserNotification } from "@auction/types";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseInboxTab } from "./inbox-empty-state";
import { countByType, groupByDateBand } from "./notification-presenters";

type InitialPage = {
  tab: InboxTab;
  type: string;
  items: UserNotification[];
  hasMore: boolean;
};

const VIEW_LABEL: Record<InboxTab, string> = {
  all: "All",
  unread: "Unread",
  archived: "Archived",
};
const VIEWS: readonly InboxTab[] = ["all", "unread", "archived"];

/**
 * The Notifications page's state: the loaded inbox grouped by day, its views and type filter,
 * and the actions on one notification or a selection of them.
 */
export function useNotificationsInboxBoard(initialPage?: InitialPage) {
  const searchParams = useSearchParams();
  const tab = parseInboxTab(searchParams.get("tab"));
  const tabParam = searchParams.get("tab");
  const typeParam = searchParams.get("type");
  const notificationFilters = parseNotificationsParams({
    ...(tabParam ? { tab: tabParam } : {}),
    ...(typeParam ? { type: typeParam } : {}),
  });

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [liveMessage, setLiveMessage] = useState<string>("");
  const liveTimeoutRef = useRef<number | null>(null);

  const announce = useCallback((message: string) => {
    setLiveMessage(message);
    if (liveTimeoutRef.current !== null) window.clearTimeout(liveTimeoutRef.current);
    liveTimeoutRef.current = window.setTimeout(() => setLiveMessage(""), 4000);
  }, []);

  const announceArrival = useCallback(
    (n: UserNotification) => {
      announce(`New notification: ${n.title}`);
      notify.info(n.title, { description: n.message, id: `inbox-${n.id}` });
    },
    [announce],
  );

  useEffect(() => {
    return () => {
      if (liveTimeoutRef.current !== null) window.clearTimeout(liveTimeoutRef.current);
    };
  }, []);

  const inbox = useNotificationsInbox({
    tab,
    type: notificationFilters.type,
    onRealtimeArrival: announceArrival,
    ...(initialPage ? { initialPage } : {}),
  });

  // A selection only holds notifications still on the page.
  useEffect(() => {
    if (selected.size === 0) return;
    const ids = new Set(inbox.items.map((item) => item.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [inbox.items, selected.size]);

  const groups = useMemo(() => groupByDateBand(inbox.items), [inbox.items]);
  const typeCounts = useMemo(() => countByType(inbox.items), [inbox.items]);
  const unreadCount = useMemo(() => inbox.items.filter((n) => !n.read).length, [inbox.items]);

  const views = useMemo(
    () =>
      VIEWS.map((id) => ({
        id,
        label: VIEW_LABEL[id],
        href: buildNotificationsHref(notificationFilters, { tab: id }),
        // Only the unread count says something; the totals are noise.
        count: id === "unread" ? unreadCount : null,
      })),
    [notificationFilters, unreadCount],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startSelecting = useCallback(() => setSelecting(true), []);
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const handleMarkRead = useCallback(
    (id: string) => {
      void inbox.markRead(id);
    },
    [inbox],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      if (await inbox.archive(id)) announce("Notification archived");
    },
    [announce, inbox],
  );

  const handleMarkAllRead = useCallback(async () => {
    const ok = await inbox.markAllRead();
    if (ok) notify.success("All notifications marked as read");
  }, [inbox]);

  const handleBulkMarkRead = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const { fulfilled } = await inbox.markReadMany(ids);
    if (fulfilled > 0) announce(`${fulfilled} marked as read`);
    stopSelecting();
  }, [announce, inbox, selected, stopSelecting]);

  const handleBulkArchive = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const { fulfilled, rejected } = await inbox.archiveMany(ids);
    if (rejected > 0) {
      notify.error(`Archived ${fulfilled} of ${ids.length}`, {
        description: "Some couldn't be archived. Try those again.",
      });
    } else {
      announce(`${fulfilled} archived`);
    }
    stopSelecting();
  }, [announce, inbox, selected, stopSelecting]);

  return {
    tab,
    notificationFilters,
    liveMessage,
    groups,
    typeCounts,
    unreadCount,
    views,
    selecting,
    selected,
    toggleSelect,
    startSelecting,
    stopSelecting,
    handleMarkRead,
    handleArchive,
    handleMarkAllRead,
    handleBulkMarkRead,
    handleBulkArchive,
    ...inbox,
  };
}
