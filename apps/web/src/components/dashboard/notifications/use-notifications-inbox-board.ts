"use client";

import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { useNotificationsInbox } from "@/components/dashboard/notifications/use-notifications-inbox";
import { parseNotificationsParams } from "@/lib/dashboard/filters/notifications/notifications-filters";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { notify } from "@/lib/ui/notify";
import type { UserNotification } from "@auction/types";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseInboxTab } from "./inbox-empty-state";
import { groupByDateBand } from "./notification-presenters";

type InitialPage = {
  tab: InboxTab;
  type: string;
  items: UserNotification[];
  hasMore: boolean;
};

/** The inbox's two views; archived notifications are kept but no longer have a view of their own. */
export const INBOX_VIEWS = [
  { id: "all", label: "All", href: CLIENT_ROUTES.notifications },
  { id: "unread", label: "Unread", href: `${CLIENT_ROUTES.notifications}?tab=unread` },
] as const;

/** The Notifications page's state: the loaded inbox grouped by day, its views and its actions. */
export function useNotificationsInboxBoard(initialPage?: InitialPage) {
  const searchParams = useSearchParams();
  const tab = parseInboxTab(searchParams.get("tab"));
  const tabParam = searchParams.get("tab");
  const typeParam = searchParams.get("type");
  const notificationFilters = parseNotificationsParams({
    ...(tabParam ? { tab: tabParam } : {}),
    ...(typeParam ? { type: typeParam } : {}),
  });

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
    type: notificationFilters.type,
    onRealtimeArrival: announceArrival,
    ...(initialPage ? { initialPage } : {}),
  });

  const groups = useMemo(() => groupByDateBand(inbox.items), [inbox.items]);
  const unreadCount = useMemo(() => inbox.items.filter((n) => !n.read).length, [inbox.items]);

  const handleMarkRead = useCallback(
    (id: string) => {
      void inbox.markRead(id);
    },
    [inbox],
  );

  const handleMarkAllRead = useCallback(async () => {
    const ok = await inbox.markAllRead();
    if (ok) notify.success("All notifications marked as read");
  }, [inbox]);

  const views = useMemo(
    () =>
      INBOX_VIEWS.map((view) => ({
        ...view,
        // Only the unread count says something; the total of all is noise.
        count: view.id === "unread" ? unreadCount : null,
      })),
    [unreadCount],
  );

  return {
    tab,
    notificationFilters,
    liveMessage,
    groups,
    unreadCount,
    views,
    handleMarkRead,
    handleMarkAllRead,
    ...inbox,
  };
}
