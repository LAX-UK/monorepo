"use client";

import { DashboardSortSelect } from "@/components/dashboard/filters";
import {
  NOTIFICATION_TYPE_OPTIONS,
  type NotificationsFilters,
  buildNotificationsHref,
} from "@/lib/dashboard/filters/notifications/notifications-filters";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** The select needs a value for "every type"; the address leaves the type out. */
const ALL_TYPES = "all";

/** Which kind of notification to show, as one compact control beside the views. */
export function NotificationsTypeSelect({ filters }: { filters: NotificationsFilters }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <DashboardSortSelect
      label="Type"
      compactOnMobile
      className="flex items-center gap-2 space-y-0"
      triggerClassName="min-h-10 w-44 bg-surface-container-lowest font-body text-sm"
      value={filters.type || ALL_TYPES}
      options={NOTIFICATION_TYPE_OPTIONS.map((option) => ({
        value: option.id || ALL_TYPES,
        label: option.label,
      }))}
      onValueChange={(value) =>
        startTransition(() =>
          router.replace(
            buildNotificationsHref(filters, { type: value === ALL_TYPES ? null : value }),
            { scroll: false },
          ),
        )
      }
    />
  );
}
