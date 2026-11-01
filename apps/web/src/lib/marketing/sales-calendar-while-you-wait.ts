import { formatLondonDate } from "@/lib/datetime/london-time";
import { formatMoney } from "@/lib/format-currency";
import type { CalendarOverview } from "@/lib/marketing/sales-calendar-overview";
import type { SaleListRow } from "@/lib/sale-list-row";
import { salePath } from "@/lib/seo/url";

export type WhileYouWaitLink = {
  id: "lastResult" | "consignments";
  title: string;
  detail: string;
  href: string;
};

export const CONSIGN_HREF = "/sell";

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Ended 15 Oct 2026 · 18 of 24 sold · £186,400"; the figures only once they are final. */
function lastResultDetail(row: SaleListRow): string {
  const ended = toDate(row.sale.endTime);
  const parts = [ended ? `Ended ${formatLondonDate(ended)}` : "Ended"];
  const summary = row.resultsSummary;
  if (summary?.state === "final") {
    parts.push(`${summary.soldCount} of ${summary.lotCount} sold`);
    parts.push(formatMoney(summary.totalWithPremium, summary.currency));
  }
  return parts.join(" · ");
}

function lastResult(overview: CalendarOverview): WhileYouWaitLink | null {
  const row = overview.results?.[0];
  if (!row) return null;
  return {
    id: "lastResult",
    title: row.sale.title,
    detail: lastResultDetail(row),
    href: salePath(row.sale),
  };
}

/** The soonest consignment deadline still ahead, on any sale that is open or coming up. */
function consignments(overview: CalendarOverview, now: Date): WhileYouWaitLink | null {
  const deadlines = [...(overview.live ?? []), ...(overview.upcoming ?? [])]
    .map((row) => (row.sale.consignmentDeadline ? toDate(row.sale.consignmentDeadline) : null))
    .filter((date): date is Date => date !== null && date.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const next = deadlines[0];
  if (!next) return null;
  return {
    id: "consignments",
    title: "Consignments are open",
    detail: `Close ${formatLondonDate(next)}`,
    href: CONSIGN_HREF,
  };
}

/** At most two real neighbours for a visitor facing an empty calendar: never another empty list. */
export function buildWhileYouWait(overview: CalendarOverview, now: Date): WhileYouWaitLink[] {
  return [lastResult(overview), consignments(overview, now)].filter(
    (link): link is WhileYouWaitLink => link !== null,
  );
}
