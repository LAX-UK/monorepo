import { RECENT_RESULTS_HREF, RECENT_RESULTS_LABEL } from "@/lib/marketing/recent-results-link";
import type { CalendarPrimaryTab } from "@/lib/marketing/sales-calendar-params";

export type CalendarEmptyStateVM = {
  title: string;
  description: string;
  /** Clear-filters is offered only when a filter is actually set. */
  action: "clearFilters" | { label: string; href: string } | null;
};

const SEE_RECENT_RESULTS = { label: RECENT_RESULTS_LABEL, href: RECENT_RESULTS_HREF } as const;

/** Copy for a calendar tab with no rows: filtered, or genuinely empty. */
export function resolveCalendarEmptyState(input: {
  tab: CalendarPrimaryTab;
  hasActiveFilters: boolean;
}): CalendarEmptyStateVM {
  if (input.hasActiveFilters) {
    return {
      title: "No sales match these filters",
      description: "Try clearing filters or choose another calendar tab.",
      action: "clearFilters",
    };
  }
  switch (input.tab) {
    case "live":
      return {
        title: "No sale is live right now",
        description: "New sales are announced here first.",
        action: SEE_RECENT_RESULTS,
      };
    case "results":
      return {
        title: "No results yet",
        description: "Results appear here once a sale has closed.",
        action: null,
      };
    default:
      return {
        title: "No sales are scheduled yet",
        description: "New sales are announced here first.",
        action: SEE_RECENT_RESULTS,
      };
  }
}
