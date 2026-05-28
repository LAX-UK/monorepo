import { buildActiveFilterDescriptors, hasActiveFilters } from "../filter-active";
import { buildFilterHref, patchFilterParams } from "../filter-params";
import type { ActiveFilterDescriptor, FilterParamsRecord, ListPageFilterConfig } from "../types";

export const NOTIFICATIONS_BASE_PATH = "/dashboard/notifications";

export type NotificationsTab = "all" | "unread" | "archived";

export type NotificationsFilters = {
  tab: NotificationsTab;
  type: string;
};

export const NOTIFICATION_TYPE_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "", label: "All types" },
  { id: "outbid", label: "Outbid" },
  { id: "lot_won", label: "Won" },
  { id: "lot_lost", label: "Lost" },
  { id: "payment_due", label: "Payment" },
  { id: "ending_soon", label: "Ending soon" },
  { id: "watchlist", label: "Watchlist" },
] as const;

export const NOTIFICATIONS_FILTER_DEFAULTS: Record<string, string | undefined> = {
  tab: undefined,
  type: undefined,
};

export const NOTIFICATIONS_FILTER_CONFIG: ListPageFilterConfig = {
  basePath: NOTIFICATIONS_BASE_PATH,
  defaults: NOTIFICATIONS_FILTER_DEFAULTS,
  filters: [
    {
      kind: "chips",
      param: "type",
      label: "Notification type",
      options: NOTIFICATION_TYPE_OPTIONS.filter((o) => o.id !== "").map((o) => ({
        id: o.id,
        label: o.label,
      })),
      placement: "primary",
    },
  ],
};

export function parseNotificationsTab(raw: string | null | undefined): NotificationsTab {
  if (raw === "unread" || raw === "archived") return raw;
  return "all";
}

export function parseNotificationsParams(raw: {
  tab?: string;
  type?: string;
}): NotificationsFilters {
  return {
    tab: parseNotificationsTab(raw.tab),
    type: (raw.type ?? "").trim(),
  };
}

export function notificationsFiltersToParams(filters: NotificationsFilters): FilterParamsRecord {
  return {
    ...(filters.tab !== "all" ? { tab: filters.tab } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };
}

export function buildNotificationsHref(
  current: NotificationsFilters,
  patch: Partial<{ tab: NotificationsTab; type: string | null }>,
): string {
  const next: NotificationsFilters = {
    tab: patch.tab ?? current.tab,
    type: patch.type === undefined ? current.type : (patch.type ?? ""),
  };
  return buildFilterHref(NOTIFICATIONS_BASE_PATH, notificationsFiltersToParams(next), {
    omitDefaults: NOTIFICATIONS_FILTER_DEFAULTS,
  });
}

export function buildNotificationsTabHref(
  current: NotificationsFilters,
  tab: NotificationsTab,
): string {
  return buildNotificationsHref(current, { tab });
}

export function hasNotificationsActiveFilters(filters: NotificationsFilters): boolean {
  return hasActiveFilters(notificationsFiltersToParams(filters), NOTIFICATIONS_FILTER_DEFAULTS, [
    "tab",
    "type",
  ]);
}

export function getNotificationsActiveFilters(
  filters: NotificationsFilters,
): ActiveFilterDescriptor[] {
  const typeLabel =
    NOTIFICATION_TYPE_OPTIONS.find((o) => o.id === filters.type)?.label ?? filters.type;

  return buildActiveFilterDescriptors(
    {
      basePath: NOTIFICATIONS_BASE_PATH,
      params: notificationsFiltersToParams(filters),
      defaults: NOTIFICATIONS_FILTER_DEFAULTS,
      omitDefaults: NOTIFICATIONS_FILTER_DEFAULTS,
    },
    [
      {
        param: "type",
        isActive: () => Boolean(filters.type),
        label: () => typeLabel,
        clearPatch: () => ({ type: undefined }),
      },
    ],
  );
}

export function countNotificationsSheetFilters(filters: NotificationsFilters): number {
  return filters.type ? 1 : 0;
}

export function patchNotificationsType(
  current: NotificationsFilters,
  typeId: string,
): NotificationsFilters {
  return parseNotificationsParams(
    patchFilterParams(notificationsFiltersToParams(current), {
      type: typeId || undefined,
    }) as { tab?: string; type?: string },
  );
}
