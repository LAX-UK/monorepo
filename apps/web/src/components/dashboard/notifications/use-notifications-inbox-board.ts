"use client";

import { inboxTabHref } from "@/components/dashboard/notifications/inbox-empty-state";
import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { useNotificationsInbox } from "@/components/dashboard/notifications/use-notifications-inbox";
import { parseNotificationsParams } from "@/lib/dashboard/filters/notifications/notifications-filters";
import { notify } from "@/lib/ui/notify";
import type { UserNotification } from "@auction/types";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseInboxTab } from "./inbox-empty-state";
import { countByType, groupByDateBand } from "./notification-presenters";

type InitialPage = {
  tab: InboxTab;
  type: string;
  items: UserNotification[];
  hasMore: boolean;
};

export function useNotificationsInboxBoard(initialPage?: InitialPage) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseInboxTab(searchParams.get("tab"));
  const tabParam = searchParams.get("tab");
  const typeParam = searchParams.get("type");
  const notificationFilters = parseNotificationsParams({
    ...(tabParam ? { tab: tabParam } : {}),
    ...(typeParam ? { type: typeParam } : {}),
  });
  const typeFilter = notificationFilters.type;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [liveMessage, setLiveMessage] = useState<string>("");
  const liveTimeoutRef = useRef<number | null>(null);

  const announceArrival = useCallback((n: UserNotification) => {
    setLiveMessage(`New notification: ${n.title}`);
    notify.info(n.title, { description: n.message, id: `inbox-${n.id}` });
    if (liveTimeoutRef.current !== null) window.clearTimeout(liveTimeoutRef.current);
    liveTimeoutRef.current = window.setTimeout(() => setLiveMessage(""), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (liveTimeoutRef.current !== null) window.clearTimeout(liveTimeoutRef.current);
    };
  }, []);

  const inbox = useNotificationsInbox({
    tab,
    type: typeFilter,
    onRealtimeArrival: announceArrival,
    ...(initialPage ? { initialPage } : {}),
  });

  useEffect(() => {
    if (selected.size === 0) return;
    setSelected((current) => {
      const ids = new Set(inbox.items.map((i) => i.id));
      const next = new Set<string>();
      for (const id of current) if (ids.has(id)) next.add(id);
      return next.size === current.size ? current : next;
    });
  }, [inbox.items, selected.size]);

  const groups = useMemo(() => groupByDateBand(inbox.items), [inbox.items]);
  const typeCounts = useMemo(() => countByType(inbox.items), [inbox.items]);
  const unreadCount = useMemo(() => inbox.items.filter((n) => !n.read).length, [inbox.items]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleMarkRead = useCallback(
    (id: string) => {
      void inbox.markRead(id);
    },
    [inbox],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      const ok = await inbox.archive(id);
      if (ok) {
        setSelected((s) => {
          if (!s.has(id)) return s;
          const next = new Set(s);
          next.delete(id);
          return next;
        });
        notify.success("Archived");
      }
    },
    [inbox],
  );

  const handleMarkAllRead = useCallback(async () => {
    const ok = await inbox.markAllRead();
    if (ok) notify.success("All notifications marked as read");
  }, [inbox]);

  const handleBulkMarkRead = useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const result = await inbox.markReadMany(ids);
    if (result.fulfilled > 0) {
      notify.success(ids.length === 1 ? "Marked as read" : `${result.fulfilled} marked as read`);
      setSelected(new Set());
    }
  }, [inbox, selected]);

  const handleBulkArchive = useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { fulfilled, rejected } = await inbox.archiveMany(ids);
    if (rejected > 0 && fulfilled > 0) {
      notify.warning(`Archived ${fulfilled} of ${ids.length}`, {
        description: `Could not archive ${rejected}. Try again on those rows.`,
      });
    } else if (rejected > 0) {
      notify.error("Could not archive selected", {
        description: "Please try again.",
      });
    } else if (fulfilled > 0) {
      notify.success(ids.length === 1 ? "Archived" : `Archived ${fulfilled}`);
    }
    setSelected((current) => {
      if (current.size === 0) return current;
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, [inbox, selected]);

  const tabs = useMemo(
    () => [
      {
        href: inboxTabHref(pathname, searchParams, "all"),
        label: "All",
        isActive: tab === "all",
      },
      {
        href: inboxTabHref(pathname, searchParams, "unread"),
        label: "Unread",
        isActive: tab === "unread",
        ...(unreadCount > 0 ? { badge: unreadCount } : {}),
      },
      {
        href: inboxTabHref(pathname, searchParams, "archived"),
        label: "Archived",
        isActive: tab === "archived",
      },
    ],
    [pathname, searchParams, tab, unreadCount],
  );

  const counterLine = useMemo(() => {
    if (inbox.loading) return "Loading notifications…";
    if (inbox.items.length === 0) return "No notifications loaded";
    if (unreadCount === 0) return `${inbox.items.length} loaded - all caught up`;
    return `${unreadCount} unread - ${inbox.items.length} loaded`;
  }, [inbox.items.length, inbox.loading, unreadCount]);

  return {
    tab,
    notificationFilters,
    selected,
    setSelected,
    liveMessage,
    groups,
    typeCounts,
    unreadCount,
    tabs,
    counterLine,
    toggleSelect,
    handleMarkRead,
    handleArchive,
    handleMarkAllRead,
    handleBulkMarkRead,
    handleBulkArchive,
    ...inbox,
  };
}
