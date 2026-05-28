"use client";

import {
  DashboardActiveFilters,
  DashboardFilterChipRow,
  DashboardFilterSheet,
  DashboardFilterTrigger,
  DashboardListToolbar,
} from "@/components/dashboard/filters";
import {
  NOTIFICATIONS_BASE_PATH,
  NOTIFICATION_TYPE_OPTIONS,
  type NotificationsFilters,
  buildNotificationsHref,
  getNotificationsActiveFilters,
} from "@/lib/dashboard/filters/notifications/notifications-filters";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  filters: NotificationsFilters;
  typeCounts: Record<string, number>;
  totalCount: number;
  loading?: boolean;
  actions?: ReactNode;
};

export function NotificationsTypeFilterToolbar({
  filters,
  typeCounts,
  totalCount,
  loading = false,
  actions,
}: Props) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const activeFilters = getNotificationsActiveFilters(filters);
  const mobileSheetCount = filters.type ? 1 : 0;

  const primaryItems = NOTIFICATION_TYPE_OPTIONS.map((chip) => {
    const count = chip.id ? (typeCounts[chip.id] ?? 0) : totalCount;
    return {
      id: chip.id || "all-types",
      label: (
        <span className="inline-flex items-center gap-2">
          <span>{chip.label}</span>
          {!loading && count > 0 ? (
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] tabular-nums",
              )}
            >
              {count}
            </span>
          ) : null}
        </span>
      ),
      href: buildNotificationsHref(filters, { type: chip.id || null }),
      active: filters.type === chip.id,
    };
  });

  const typeFilterRow = <DashboardFilterChipRow label="Notification type" items={primaryItems} />;

  const mobileFilterSheet = (
    <DashboardFilterSheet
      open={mobileSheetOpen}
      onOpenChange={setMobileSheetOpen}
      title="Notification filters"
      trigger={<DashboardFilterTrigger activeCount={mobileSheetCount} />}
    >
      {typeFilterRow}
    </DashboardFilterSheet>
  );

  return (
    <div className="space-y-3">
      <DashboardListToolbar
        primaryFilters={typeFilterRow}
        mobileFilterSheet={mobileFilterSheet}
        actions={actions}
        actionsOverflowLabel="Notification actions"
      />
      <DashboardActiveFilters filters={activeFilters} clearAllHref={NOTIFICATIONS_BASE_PATH} />
    </div>
  );
}
