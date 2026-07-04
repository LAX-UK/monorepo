"use client";

import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import { InboxEmptyState } from "@/components/dashboard/notifications/inbox-empty-state";
import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { NotificationsTypeFilterToolbar } from "@/components/dashboard/notifications/notifications-type-filter-toolbar";
import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import type { UserNotification } from "@auction/types";
import { BulkActionBar } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { CheckCheck, RefreshCcw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { notificationTypePresenter } from "./notifications/notification-presenters";
import { NotificationRow } from "./notifications/notification-row";
import { NotificationsSkeleton } from "./notifications/notifications-skeleton";
import { useNotificationsInboxBoard } from "./notifications/use-notifications-inbox-board";

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
  const board = useNotificationsInboxBoard(initialPage);

  const markAllReadAction = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={board.loading || board.unreadCount === 0}
      onClick={() => void board.handleMarkAllRead()}
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
              items={board.tabs}
            />
          </Surface>
        )
      }
      toolbar={
        loadFailure ? undefined : (
          <NotificationsTypeFilterToolbar
            filters={board.notificationFilters}
            typeCounts={board.typeCounts}
            totalCount={board.items.length}
            loading={board.loading}
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
        ) : board.error ? (
          <DashboardErrorAlert title="Could not load notifications" message={board.error}>
            <Button type="button" variant="outline" size="sm" onClick={() => void board.retry()}>
              <RefreshCcw className="mr-2 size-3.5" aria-hidden />
              Try again
            </Button>
          </DashboardErrorAlert>
        ) : undefined
      }
    >
      <div className="min-w-0 pb-[var(--page-bottom-padding)]">
        <output className="sr-only" aria-live="polite" aria-atomic="true">
          {board.liveMessage}
        </output>

        {loadFailure ? null : (
          <>
            {!board.loading ? (
              <DashboardFilterResultsAnnouncer
                count={board.items.length}
                entityLabel="notifications"
              />
            ) : null}

            <p className="font-body text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              {board.counterLine}
            </p>

            <div className="mt-3">
              <BulkActionBar count={board.selected.size} offsetBottomChrome>
                <Button
                  type="button"
                  variant="primary"
                  className="min-h-11"
                  onClick={() => void board.handleBulkMarkRead()}
                >
                  Mark read
                </Button>
                <Button
                  type="button"
                  variant="secondaryOutline"
                  className="min-h-11"
                  onClick={() => void board.handleBulkArchive()}
                >
                  Archive
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  className="min-h-11"
                  onClick={() => board.setSelected(new Set())}
                >
                  Clear
                </Button>
              </BulkActionBar>
            </div>

            <div>
              {board.loading ? (
                <NotificationsSkeleton rows={6} />
              ) : board.items.length === 0 ? (
                <InboxEmptyState tab={board.tab} filters={board.notificationFilters} />
              ) : (
                <div className="space-y-6" aria-label="Notification groups">
                  {board.groups.map((group) => (
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
                              selected={board.selected.has(item.id)}
                              selectionActive={board.selected.size > 0}
                              onToggleSelect={board.toggleSelect}
                              onMarkRead={board.handleMarkRead}
                              onArchive={(id) => void board.handleArchive(id)}
                            />
                          ))}
                        </ul>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {!board.loading && !board.error && board.hasMore ? (
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="secondaryOutline"
                  disabled={board.loadingMore}
                  onClick={() => void board.loadMore()}
                >
                  {board.loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}

            <p className="mt-10 font-body text-sm text-on-surface-variant">
              Tip: enable browser push in{" "}
              <Link
                href="/dashboard/settings/notifications"
                className="text-link underline-offset-2 hover:underline"
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
