import { atgDisplaySale } from "@/lib/catalog/atg-catalog-display";
import {
  formatLondonDate,
  formatLondonDayMonth,
  formatLondonMonthYear,
  formatLondonTimeWithZone,
  formatLondonWeekday,
  toDate,
} from "@/lib/datetime/london-time";
import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import type { HomeComingUp, HomeComingUpRow } from "@/lib/home-sections/types";
import type { SaleListRow } from "@/lib/sale-list-row";
import { formatSaleLotsLabel } from "@/lib/sale-list-row";
import { salePath } from "@/lib/seo/url";
import type { Sale } from "@auction/types";

/** Sales further off than this are shown by month, not by day. */
const EXACT_DATE_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export const CONSIGN_HREF = "/sell";

function deliveryLine(sale: Sale): string {
  if (sale.deliveryMode === "online") return "Online";
  const place = sale.locationCity?.trim();
  if (sale.deliveryMode === "hybrid") return "Online and in the room";
  return place ? `In the room, ${place}` : "In the room";
}

function consignmentDeadline(sale: Sale, now: Date): Date | null {
  const deadline = toDate(sale.consignmentDeadline);
  return deadline && deadline.getTime() > now.getTime() ? deadline : null;
}

function dates(sale: Sale, now: Date): Pick<HomeComingUpRow, "dateMain" | "dateSub"> {
  const start = sale.startTime;
  if (start.getTime() - now.getTime() > EXACT_DATE_DAYS * DAY_MS) {
    return {
      dateMain: formatLondonMonthYear(start, { short: true }),
      dateSub: `Opens ${formatLondonWeekday(start)} ${formatLondonDayMonth(start, now)}`,
    };
  }
  return {
    dateMain: formatLondonDayMonth(start, now).replace(/ \d{4}$/, ""),
    dateSub: `${formatLondonWeekday(start)} · ${formatLondonTimeWithZone(start)}`,
  };
}

function rowFor(row: SaleListRow, now: Date): HomeComingUpRow {
  const sale = atgDisplaySale(row.sale, now);
  const deadline = consignmentDeadline(sale, now);
  const hasLots = row.lotCount > 0;
  const meta = [
    deliveryLine(sale),
    hasLots ? formatSaleLotsLabel(row.lotCount) : null,
    !hasLots && deadline ? `consignments close ${formatLondonDate(deadline)}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
  const action =
    hasLots || !deadline
      ? { href: salePath(sale), label: hasLots ? "Preview" : "View sale" }
      : { href: CONSIGN_HREF, label: "Consign a work" };
  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    meta,
    action,
    ...dates(sale, now),
  };
}

/** The sales still to come, soonest first, as an exhibition-style list. `null` when none. */
export function buildComingUp(
  rows: readonly SaleListRow[],
  saleIds: readonly string[],
  now: Date,
): HomeComingUp | null {
  const byId = new Map(rows.map((row) => [row.sale.id, row]));
  const shown = saleIds
    .flatMap((id) => byId.get(id) ?? [])
    .slice(0, HOME_SECTION_LIMITS.comingUp.max)
    .map((row) => rowFor(row, now));
  if (shown.length < HOME_SECTION_LIMITS.comingUp.min) return null;
  return { rows: shown, seeAll: { href: "/sales", label: "Auction calendar" } };
}
