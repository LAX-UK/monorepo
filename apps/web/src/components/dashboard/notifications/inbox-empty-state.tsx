"use client";

import { FilterEmptyState } from "@/components/app/filter-empty-state";
import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  buildNotificationsHref,
  hasNotificationsActiveFilters,
  type parseNotificationsParams,
} from "@/lib/dashboard/filters/notifications/notifications-filters";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type InboxEmptyStateProps = {
  tab: InboxTab;
  filters: ReturnType<typeof parseNotificationsParams>;
};

export function InboxEmptyState({ tab, filters }: InboxEmptyStateProps) {
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

export function parseInboxTab(raw: string | null): InboxTab {
  if (raw === "unread" || raw === "archived") return raw;
  return "all";
}

export function inboxTabHref(pathname: string, params: URLSearchParams, tab: InboxTab): string {
  const next = new URLSearchParams(params.toString());
  if (tab === "all") next.delete("tab");
  else next.set("tab", tab);
  next.delete("view");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
