import type { CalendarPrimaryTab } from "@/lib/marketing/sales-calendar-params";
import type { CalendarTabCounts } from "@/lib/marketing/sales-calendar-tabs";
import type { SaleListRow } from "@/lib/sale-list-row";

/** The sales behind each calendar section. A section that failed to load is absent. */
export type CalendarOverview = Partial<Record<CalendarPrimaryTab, SaleListRow[]>>;

/** Section counts, from the rows read for each. */
export function calendarTabCounts(overview: CalendarOverview): CalendarTabCounts {
  const counts: CalendarTabCounts = {};
  for (const [tab, rows] of Object.entries(overview) as [CalendarPrimaryTab, SaleListRow[]][]) {
    counts[tab] = rows.length;
  }
  return counts;
}
