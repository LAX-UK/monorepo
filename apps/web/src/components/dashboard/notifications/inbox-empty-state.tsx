"use client";

import { FilterEmptyState } from "@/components/app/filter-empty-state";
import type { InboxTab } from "@/components/dashboard/notifications/inbox-tab";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  buildNotificationsHref,
  hasNotificationsActiveFilters,
  type parseNotificationsParams,
} from "@/lib/dashboard/filters/notifications/notifications-filters";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type InboxEmptyStateProps = {
  tab: InboxTab;
  filters: ReturnType<typeof parseNotificationsParams>;
};

/**
 * What an empty notifications view says. "Choose what we send" is not repeated here: it sits in
 * the toolbar above every view.
 */
export function InboxEmptyState({ tab, filters }: InboxEmptyStateProps) {
  // A type is chosen and nothing of that type is in this view.
  if (hasNotificationsActiveFilters(filters) && filters.type) {
    return (
      <FilterEmptyState
        segment="dashboard"
        entity="notifications"
        clearFiltersHref={buildNotificationsHref(filters, { type: null })}
      />
    );
  }
  if (tab === "all") {
    return (
      <DashboardEmptyState
        variant="hero"
        illustration="plinth"
        title={DASHBOARD_EMPTY.notifications.title}
        description={DASHBOARD_EMPTY.notifications.description}
      />
    );
  }
  return (
    <DashboardEmptyState
      illustration="plinth"
      title={tab === "unread" ? "Nothing unread" : "Nothing archived"}
      description={
        tab === "unread"
          ? "You're up to date. Everything we sent you is under All."
          : "Archived notifications appear here."
      }
      action={
        <Button variant="secondaryOutline" asChild>
          <Link href={CLIENT_ROUTES.notifications}>Show all</Link>
        </Button>
      }
    />
  );
}

export function parseInboxTab(raw: string | null): InboxTab {
  if (raw === "unread" || raw === "archived") return raw;
  return "all";
}
