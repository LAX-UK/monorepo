"use client";

import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { Button } from "@/components/ui/button";
import { type UnderlineTab, UnderlineTabs } from "@/components/ui/underline-tabs";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { notify } from "@/lib/ui/notify";
import type { UserNotification } from "@auction/types";
import { Alert, AlertDescription, AlertTitle, BulkActionBar, cn } from "@auction/ui";
import { Button as ShadButton } from "@auction/ui/components/button";
import { CheckCheck, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countByType,
  groupByDateBand,
  notificationTypePresenter,
} from "./notifications/notification-presenters";
import { NotificationRow } from "./notifications/notification-row";
import { NotificationsSkeleton } from "./notifications/notifications-skeleton";
import { useNotificationsInbox } from "./notifications/use-notifications-inbox";

const TYPE_CHIPS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "", label: "All types" },
  { key: "outbid", label: "Outbid" },
  { key: "lot_won", label: "Won" },
  { key: "lot_lost", label: "Lost" },
  { key: "payment_due", label: "Payment" },
  { key: "ending_soon", label: "Ending soon" },
  { key: "watchlist", label: "Watchlist" },
];

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
  loadFailure = null,
  initialPage,
}: {
  loadFailure?: DashboardSliceFailure | null;
  initialPage?: {
    tab: InboxTab;
    type: string;
    items: UserNotification[];
    hasMore: boolean;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const typeFilter = (searchParams.get("type") ?? "").trim();

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

  const writeParam = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setTypeFilter = useCallback(
    (next: string) => {
      writeParam((p) => {
        if (next) p.set("type", next);
        else p.delete("type");
      });
    },
    [writeParam],
  );

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

  const tabs = useMemo<ReadonlyArray<UnderlineTab<InboxTab>>>(
    () => [
      {
        id: "all",
        label: "All",
        href: tabHref(pathname, searchParams, "all"),
      },
      {
        id: "unread",
        label: "Unread",
        href: tabHref(pathname, searchParams, "unread"),
        ...(unreadCount > 0 && tab === "unread"
          ? {
              badge: (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-label text-[10px] font-semibold tracking-normal text-on-primary">
                  {unreadCount}
                </span>
              ),
            }
          : {}),
      },
      {
        id: "archived",
        label: "Archived",
        href: tabHref(pathname, searchParams, "archived"),
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

  return (
    <div
      className={cn("mx-auto max-w-5xl py-10", selected.size > 0 ? "pb-28 md:pb-10" : undefined)}
    >
      <DashboardPageHeader
        meta="Buying"
        title="Notifications"
        description="Bids, wins, payments, and saved-lot updates. Live when you are online."
        actions={
          <Button type="button" variant="tertiary" asChild>
            <Link href="/dashboard/settings/notifications">Alert settings</Link>
          </Button>
        }
      />

      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </output>

      {loadFailure ? (
        <div className="mt-6">
          <DashboardSliceErrorAlert failure={loadFailure} />
        </div>
      ) : (
        <>
          <div className="mt-8">
            <UnderlineTabs<InboxTab> ariaLabel="Notification filters" active={tab} tabs={tabs} />
          </div>

          <div className="-mx-1 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            {TYPE_CHIPS.map((chip) => {
              const isActive = typeFilter === chip.key;
              const count = chip.key ? (typeCounts[chip.key] ?? 0) : items.length;
              return (
                <ShadButton
                  key={chip.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTypeFilter(chip.key)}
                  aria-pressed={isActive}
                  className={cn(
                    "h-auto shrink-0 snap-start gap-2 rounded-full px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 transition-colors",
                    isActive
                      ? "bg-primary text-on-primary ring-primary hover:bg-primary hover:text-on-primary"
                      : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80",
                  )}
                >
                  <span>{chip.label}</span>
                  {!loading && count > 0 ? (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] tabular-nums",
                        isActive
                          ? "bg-on-primary/15 text-on-primary"
                          : "bg-on-surface/10 text-on-surface",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </ShadButton>
              );
            })}
          </div>

          {error ? (
            <Alert
              role="alert"
              variant="destructive"
              className="mt-6 rounded-xl border-error/40 shadow-sm"
            >
              <AlertTitle>Could not load notifications</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{error}</span>
                <ShadButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void retry()}
                  className="gap-2"
                >
                  <RefreshCcw className="size-3.5" aria-hidden />
                  Try again
                </ShadButton>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="font-body text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              {counterLine}
            </p>
            <ShadButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading || unreadCount === 0}
              onClick={() => void handleMarkAllRead()}
              className="gap-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:bg-primary/10"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read
            </ShadButton>
          </div>

          <div className="mt-3">
            <BulkActionBar count={selected.size}>
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
                variant="secondary"
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

          <div className="mt-4">
            {loading ? (
              <NotificationsSkeleton rows={6} />
            ) : items.length === 0 ? (
              <InboxEmptyState
                tab={tab}
                typeFilter={typeFilter}
                onClearType={() => setTypeFilter("")}
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest shadow-sm">
                {groups.map((group) => (
                  <section key={group.band} aria-labelledby={`band-${group.band}`}>
                    <h2
                      id={`band-${group.band}`}
                      className="sticky top-[var(--header-height-shell,52px)] z-10 border-b border-border-hairline bg-surface-container-low/95 px-4 py-2 font-label text-[11px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant backdrop-blur"
                    >
                      {group.band}
                    </h2>
                    <ul className="divide-y divide-outline-variant/10">
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
                  </section>
                ))}
              </div>
            )}
          </div>

          {!loading && !error && hasMore ? (
            <div className="mt-8 flex justify-center">
              <Button
                type="button"
                variant="secondary"
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
              alert settings
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}

type InboxEmptyStateProps = {
  tab: InboxTab;
  typeFilter: string;
  onClearType: () => void;
};

function InboxEmptyState({ tab, typeFilter, onClearType }: InboxEmptyStateProps) {
  if (typeFilter) {
    return (
      <DashboardEmptyState
        title="Nothing matches that type"
        description="Try clearing the type filter to see all notifications in this tab."
        action={
          <Button type="button" variant="secondary" onClick={onClearType}>
            Show all types
          </Button>
        }
      />
    );
  }
  if (tab === "unread") {
    return (
      <DashboardEmptyState
        title="No unread notifications"
        description="You're up to date. Switch to All to see your full history."
        action={
          <Button type="button" variant="secondary" asChild>
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
          <Button type="button" variant="secondary" asChild>
            <Link href="/dashboard/notifications">Back to All</Link>
          </Button>
        }
      />
    );
  }
  return (
    <DashboardEmptyState
      title="You're all caught up"
      description="We'll surface bids, wins, payments, and saved-lot updates here as they happen."
      action={
        <Button type="button" variant="secondary" asChild>
          <Link href="/sales">Browse auctions</Link>
        </Button>
      }
    />
  );
}
