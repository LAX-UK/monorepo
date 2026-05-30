"use client";

import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { NotificationsTypeFilterToolbar } from "@/components/dashboard/notifications/notifications-type-filter-toolbar";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import {
  buildNotificationsHref,
  hasNotificationsActiveFilters,
  parseNotificationsParams,
} from "@/lib/dashboard/filters/notifications/notifications-filters";
import { notify } from "@/lib/ui/notify";
import type { UserNotification } from "@auction/types";
import { BulkActionBar } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { CheckCheck, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countByType,
  groupByDateBand,
  notificationTypePresenter,
} from "./notifications/notification-presenters";
import { NotificationRow } from "./notifications/notification-row";
import { NotificationsSkeleton } from "./notifications/notifications-skeleton";
import { useNotificationsInbox } from "./notifications/use-notifications-inbox";

function parseTab(raw: string | null): InboxTab {
  if (raw === "unread" || raw === "archived") return raw;
  return "all";
}

function tabHref(pathname: string, params: URLSearchParams, tab: InboxTab): string {
  const next = new URLSearchParams(params.toString());
  if (tab === "all") next.delete("tab");
  else next.set("tab", tab);
  next.delete("view");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function NotificationsInboxBoard({
  pageMeta,
  loadFailure = null,
  initialPage,
}: {
  pageMeta: ReactNode;
  loadFailure?: DashboardSliceFailure | null;
  initialPage?: {
    tab: InboxTab;
    type: string;
    items: UserNotification[];
    hasMore: boolean;
  };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
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

  const {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    retry,
    markRead,
    markReadMany,
    markAllRead,
    archive,
    archiveMany,
  } = useNotificationsInbox({
    tab,
    type: typeFilter,
    onRealtimeArrival: announceArrival,
    ...(initialPage ? { initialPage } : {}),
  });

  useEffect(() => {
    if (selected.size === 0) return;
    setSelected((current) => {
      const ids = new Set(items.map((i) => i.id));
      const next = new Set<string>();
      for (const id of current) if (ids.has(id)) next.add(id);
      return next.size === current.size ? current : next;
    });
  }, [items, selected.size]);

  const groups = useMemo(() => groupByDateBand(items), [items]);
  const typeCounts = useMemo(() => countByType(items), [items]);
  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

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
      void markRead(id);
    },
    [markRead],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      const ok = await archive(id);
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
    [archive],
  );

  const handleMarkAllRead = useCallback(async () => {
    const ok = await markAllRead();
    if (ok) notify.success("All notifications marked as read");
  }, [markAllRead]);

  const handleBulkMarkRead = useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const result = await markReadMany(ids);
    if (result.fulfilled > 0) {
      notify.success(ids.length === 1 ? "Marked as read" : `${result.fulfilled} marked as read`);
      setSelected(new Set());
    }
  }, [markReadMany, selected]);

  const handleBulkArchive = useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { fulfilled, rejected } = await archiveMany(ids);
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
  }, [archiveMany, selected]);

  const tabs = useMemo(
    () => [
      {
        href: tabHref(pathname, searchParams, "all"),
        label: "All",
        isActive: tab === "all",
      },
      {
        href: tabHref(pathname, searchParams, "unread"),
        label: "Unread",
        isActive: tab === "unread",
        ...(unreadCount > 0 ? { badge: unreadCount } : {}),
      },
      {
        href: tabHref(pathname, searchParams, "archived"),
        label: "Archived",
        isActive: tab === "archived",
      },
    ],
    [pathname, searchParams, tab, unreadCount],
  );

  const counterLine = useMemo(() => {
    if (loading) return "Loading notifications…";
    if (items.length === 0) return "No notifications loaded";
    if (unreadCount === 0) return `${items.length} loaded - all caught up`;
    return `${unreadCount} unread - ${items.length} loaded`;
  }, [items.length, loading, unreadCount]);

  const markAllReadAction = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={loading || unreadCount === 0}
      onClick={() => void handleMarkAllRead()}
      className="gap-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:bg-primary/10"
    >
      <CheckCheck className="size-3.5" aria-hidden />
      Mark all read
    </Button>
  );

  return (
    <DashboardListPage
      meta={pageMeta}
      title="Notifications"
      description="Bids, wins, payments, and saved-lot updates. Live when you are online."
      actions={loadFailure ? undefined : markAllReadAction}
      tabs={
        loadFailure ? undefined : (
          <Surface variant="inset" padding="sm">
            <SectionTabsNav
              variant="underline"
              ariaLabel="Notification inbox"
              sticky={false}
              items={tabs}
            />
          </Surface>
        )
      }
      toolbar={
        loadFailure ? undefined : (
          <NotificationsTypeFilterToolbar
            filters={notificationFilters}
            typeCounts={typeCounts}
            totalCount={items.length}
            loading={loading}
            actions={
              <Button type="button" variant="tertiary" asChild>
                <Link href="/dashboard/settings/notifications">Notification settings</Link>
              </Button>
            }
          />
        )
      }
      errorAlert={
        loadFailure ? (
          <DashboardSliceErrorAlert failure={loadFailure} />
        ) : error ? (
          <DashboardErrorAlert title="Could not load notifications" message={error}>
            <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
              <RefreshCcw className="mr-2 size-3.5" aria-hidden />
              Try again
            </Button>
          </DashboardErrorAlert>
        ) : undefined
      }
    >
      <div className="min-w-0 pb-[var(--page-bottom-padding)]">
        <output className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </output>

        {loadFailure ? null : (
          <>
            {!loading ? (
              <DashboardFilterResultsAnnouncer count={items.length} entityLabel="notifications" />
            ) : null}

            <p className="font-body text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              {counterLine}
            </p>

            <div className="mt-3">
              <BulkActionBar count={selected.size} offsetBottomChrome>
                <Button
                  type="button"
                  variant="primary"
                  className="min-h-11"
                  onClick={() => void handleBulkMarkRead()}
                >
                  Mark read
                </Button>
                <Button
                  type="button"
                  variant="secondaryOutline"
                  className="min-h-11"
                  onClick={() => void handleBulkArchive()}
                >
                  Archive
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  className="min-h-11"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
              </BulkActionBar>
            </div>

            <div>
              {loading ? (
                <NotificationsSkeleton rows={6} />
              ) : items.length === 0 ? (
                <InboxEmptyState tab={tab} filters={notificationFilters} />
              ) : (
                <div className="space-y-6" aria-label="Notification groups">
                  {groups.map((group) => (
                    <section key={group.band} aria-labelledby={`band-${group.band}`}>
                      <h2
                        id={`band-${group.band}`}
                        className="mb-2 px-1 font-label text-[11px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
                      >
                        {group.band}
                      </h2>
                      <div className="overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest shadow-sm">
                        <ul
                          aria-label={`${group.band} notifications`}
                          className="divide-y divide-outline-variant/10"
                        >
                          {group.items.map((item) => (
                            <NotificationRow
                              key={item.id}
                              item={item}
                              presentation={notificationTypePresenter(item.type)}
                              selected={selected.has(item.id)}
                              selectionActive={selected.size > 0}
                              onToggleSelect={toggleSelect}
                              onMarkRead={handleMarkRead}
                              onArchive={(id) => void handleArchive(id)}
                            />
                          ))}
                        </ul>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {!loading && !error && hasMore ? (
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="secondaryOutline"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}

            <p className="mt-10 font-body text-sm text-on-surface-variant">
              Tip: enable browser push in{" "}
              <Link
                href="/dashboard/settings/notifications"
                className="text-primary underline-offset-2 hover:underline"
              >
                notification settings
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </DashboardListPage>
  );
}

type InboxEmptyStateProps = {
  tab: InboxTab;
  filters: ReturnType<typeof parseNotificationsParams>;
};

function InboxEmptyState({ tab, filters }: InboxEmptyStateProps) {
  if (hasNotificationsActiveFilters(filters) && filters.type) {
    return (
      <FilterEmptyState
        segment="dashboard"
        entity="notifications"
        clearFiltersHref={buildNotificationsHref(filters, { type: null })}
      />
    );
  }
  if (tab === "unread") {
    return (
      <DashboardEmptyState
        title="No unread notifications"
        description="You're up to date. Switch to All to see your full history."
        action={
          <Button type="button" variant="secondaryOutline" asChild>
            <Link href="/dashboard/notifications">View all</Link>
          </Button>
        }
      />
    );
  }
  if (tab === "archived") {
    return (
      <DashboardEmptyState
        title="Nothing archived"
        description="Archived notifications appear here. Archive a row to move it out of the active inbox."
        action={
          <Button type="button" variant="secondaryOutline" asChild>
            <Link href="/dashboard/notifications">Back to All</Link>
          </Button>
        }
      />
    );
  }
  return (
    <DashboardEmptyState
      title={DASHBOARD_EMPTY.notifications.title}
      description={DASHBOARD_EMPTY.notifications.description}
      action={
        <Button type="button" variant="secondaryOutline" asChild>
          <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
        </Button>
      }
    />
  );
}
