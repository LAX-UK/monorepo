"use client";

import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { InboxEmptyState } from "@/components/dashboard/notifications/inbox-empty-state";
import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { ACCOUNT_LOAD_ERROR, DASHBOARD_CTA } from "@/lib/dashboard/dashboard-copy";
import { NOTIFICATION_SETTINGS_HREF } from "@/lib/navigation/settings-links";
import { AccountViewTabs } from "@auction/marketing-ui";
import type { UserNotification } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Check } from "lucide-react";
import Link from "next/link";
import { notificationTypePresenter } from "./notifications/notification-presenters";
import { NotificationRow } from "./notifications/notification-row";
import { NotificationsSkeleton } from "./notifications/notifications-skeleton";
import { NotificationsTypeSelect } from "./notifications/notifications-type-select";
import { useNotificationsInboxBoard } from "./notifications/use-notifications-inbox-board";

/**
 * Notifications: All, Unread and Archived, grouped by day with unread first, each opening what it
 * is about and marking itself read. A type filter sits beside the views; Select picks several to
 * mark read or archive at once. "Mark all as read" sits in the page head.
 */
export function NotificationsInboxBoard({
  loadFailure = false,
  initialPage,
}: {
  /** The first page could not be read on the server. */
  loadFailure?: boolean;
  initialPage?: {
    tab: InboxTab;
    type: string;
    items: UserNotification[];
    hasMore: boolean;
  };
}) {
  const board = useNotificationsInboxBoard(initialPage);
  const failed = loadFailure || Boolean(board.error);

  return (
    <DashboardListPage
      title="Notifications"
      description="Updates on your bids, purchases and selling."
      actions={
        failed ? undefined : (
          <Button
            type="button"
            variant="ghost"
            size="default"
            disabled={board.loading || board.unreadCount === 0}
            onClick={() => void board.handleMarkAllRead()}
          >
            <Check aria-hidden />
            Mark all as read
          </Button>
        )
      }
    >
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {board.liveMessage}
      </output>
      {failed ? (
        <AccountLoadError
          {...ACCOUNT_LOAD_ERROR.notifications}
          {...(board.error ? { onRetry: () => void board.retry() } : {})}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <AccountViewTabs label="Notifications" currentId={board.tab} tabs={board.views} />
              <NotificationsTypeSelect filters={board.notificationFilters} />
            </div>
            <Link
              href={NOTIFICATION_SETTINGS_HREF}
              className="font-body text-sm text-on-surface underline underline-offset-4 hover:decoration-2"
            >
              {DASHBOARD_CTA.chooseWhatWeSend}
            </Link>
          </div>

          {board.items.length > 0 && !board.loading ? (
            board.selecting ? (
              <section
                aria-label="Selected notifications"
                className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 py-2.5"
              >
                <p
                  className="mr-auto font-body text-sm font-medium text-on-surface"
                  aria-live="polite"
                >
                  {board.selected.size === 0
                    ? "Choose notifications"
                    : `${board.selected.size} selected`}
                </p>
                <Button
                  type="button"
                  variant="secondaryOutline"
                  size="default"
                  disabled={board.selected.size === 0}
                  onClick={() => void board.handleBulkMarkRead()}
                >
                  Mark as read
                </Button>
                {board.tab === "archived" ? null : (
                  <Button
                    type="button"
                    variant="secondaryOutline"
                    size="default"
                    disabled={board.selected.size === 0}
                    onClick={() => void board.handleBulkArchive()}
                  >
                    Archive
                  </Button>
                )}
                <Button type="button" variant="ghost" size="default" onClick={board.stopSelecting}>
                  Done
                </Button>
              </section>
            ) : (
              <div className="-mt-2 flex justify-end">
                <Button type="button" variant="ghost" size="default" onClick={board.startSelecting}>
                  Select
                </Button>
              </div>
            )
          ) : null}

          {board.loading ? (
            <NotificationsSkeleton rows={6} />
          ) : board.items.length === 0 ? (
            <InboxEmptyState tab={board.tab} filters={board.notificationFilters} />
          ) : (
            <div className="flex flex-col gap-6" aria-label="Notifications by day">
              {board.groups.map((group) => (
                <section key={group.band} aria-labelledby={`band-${group.band}`}>
                  <h2
                    id={`band-${group.band}`}
                    className="mb-2.5 font-body text-sm text-on-surface-variant"
                  >
                    {group.band}
                  </h2>
                  <ul className="divide-y divide-outline-variant/50 overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest">
                    {group.items.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        presentation={notificationTypePresenter(item.type)}
                        onMarkRead={board.handleMarkRead}
                        onArchive={(id) => void board.handleArchive(id)}
                        selecting={board.selecting}
                        selected={board.selected.has(item.id)}
                        onToggleSelect={board.toggleSelect}
                        archived={board.tab === "archived"}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {!board.loading && board.hasMore ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondaryOutline"
                size="default"
                disabled={board.loadingMore}
                onClick={() => void board.loadMore()}
              >
                {board.loadingMore ? "Loading…" : "Show older notifications"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </DashboardListPage>
  );
}
