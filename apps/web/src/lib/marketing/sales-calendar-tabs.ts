import type { CalendarPrimaryTab } from "@/lib/marketing/sales-calendar-params";

/** How many sales each calendar section holds. A section whose count could not be read is absent. */
export type CalendarTabCounts = Partial<Record<CalendarPrimaryTab, number>>;

export type CalendarTab = {
  id: CalendarPrimaryTab;
  label: string;
  /** Present only above zero. */
  count?: number;
};

const TAB_LABELS: Record<CalendarPrimaryTab, string> = {
  live: "Live now",
  upcoming: "Upcoming",
  results: "Results",
};

/** Live leads when it is shown; upcoming sales come before results. */
const TAB_ORDER: readonly CalendarPrimaryTab[] = ["live", "upcoming", "results"];

/** Whether a sale is open for bidding. */
export function hasLiveSales(counts: CalendarTabCounts): boolean {
  return (counts.live ?? 0) > 0;
}

/**
 * The tabs to draw. Live appears only while something is live (or when it is the tab being
 * viewed, so a shared link never loses its tab). Counts show only above zero.
 */
export function resolveCalendarTabs(
  counts: CalendarTabCounts,
  activeTab: CalendarPrimaryTab,
): CalendarTab[] {
  return TAB_ORDER.filter(
    (id) => id !== "live" || hasLiveSales(counts) || activeTab === "live",
  ).map((id) => {
    const count = counts[id];
    return {
      id,
      label: TAB_LABELS[id],
      ...(count !== undefined && count > 0 ? { count } : {}),
    };
  });
}
