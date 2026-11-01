import { RECENT_RESULTS_HREF, RECENT_RESULTS_LABEL } from "@/lib/marketing/recent-results-link";
import type { CalendarPrimaryTab } from "@/lib/marketing/sales-calendar-params";

export type CalendarEmptyStateVM = {
  title: string;
  description: string;
  /**
   * `alerts` is the page-level empty state: the sign-up, the way to recent results and the
   * neighbours. `clearFilters` keeps the filters in place and offers the way out.
   */
  kind: "alerts" | "clearFilters";
  /** Whether "See recent results" helps: not on the results tab, which is where it leads. */
  offersRecentResults: boolean;
};

export const SEE_RECENT_RESULTS = { label: RECENT_RESULTS_LABEL, href: RECENT_RESULTS_HREF };

/** Copy for a calendar tab with no rows: filtered, or genuinely empty. */
export function resolveCalendarEmptyState(input: {
  tab: CalendarPrimaryTab;
  hasActiveFilters: boolean;
}): CalendarEmptyStateVM {
  if (input.hasActiveFilters) {
    return {
      title: "No sales match these filters",
      description: "Try clearing filters or choose another calendar tab.",
      kind: "clearFilters",
      offersRecentResults: false,
    };
  }
  switch (input.tab) {
    case "live":
      return {
        title: "No sale is live right now",
        description:
          "New sales are announced here first. Leave your email to hear when dates are set.",
        kind: "alerts",
        offersRecentResults: true,
      };
    case "results":
      return {
        title: "No results yet",
        description:
          "Results appear here once a sale has closed. Leave your email to hear about the next sale.",
        kind: "alerts",
        offersRecentResults: false,
      };
    default:
      return {
        title: "No sales are scheduled yet",
        description:
          "New sales are announced here first. Leave your email to hear when dates are set.",
        kind: "alerts",
        offersRecentResults: true,
      };
  }
}
