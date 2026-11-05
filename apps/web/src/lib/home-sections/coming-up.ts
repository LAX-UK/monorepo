import { atgDisplaySale } from "@/lib/catalog/atg-catalog-display";
import {
  formatLondonDate,
  formatLondonDayMonth,
  formatLondonTimeWithZone,
  formatLondonWeekday,
  toDate,
} from "@/lib/datetime/london-time";
import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import type {
  HomeCardImage,
  HomeComingUp,
  HomeComingUpLayout,
  HomeComingUpRow,
} from "@/lib/home-sections/types";
import { coverTimeLeft } from "@/lib/marketing-cover/cover-time";
import type { SaleListRow } from "@/lib/sale-list-row";
import { formatSaleLotsLabel } from "@/lib/sale-list-row";
import { salePath } from "@/lib/seo/url";
import type { Sale } from "@auction/types";

const HOUR_MS = 60 * 60 * 1000;

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

/** Always day and month, the year only when it is not this year; the weekday and time beside it. */
function dates(sale: Sale, now: Date): Pick<HomeComingUpRow, "dateMain" | "dateSub"> {
  const start = sale.startTime;
  return {
    dateMain: formatLondonDayMonth(start, now),
    dateSub: `${formatLondonWeekday(start)} · ${formatLondonTimeWithZone(start)}`,
  };
}

/** The sale's staff-chosen cover, when it has one; the card crops it at the focal point staff set. */
function coverImage(sale: Sale): HomeCardImage | null {
  const slot = sale.coverSlotAssets?.default;
  return slot ? { src: slot.src, alt: slot.alt, focal: slot.focal } : null;
}

/** One sale stands alone as a wide card; two or three sit in a row. */
export function comingUpLayout(count: number): HomeComingUpLayout {
  return count <= 1 ? "feature" : "row";
}

/**
 * What the date block does not say: how long to go. Nothing beyond a week (the date is enough),
 * days and hours within it, seconds in the final hour, "Live now" once the start has passed.
 */
function timeFor(sale: Sale, now: Date): HomeComingUpRow["time"] {
  const ms = sale.startTime.getTime() - now.getTime();
  if (ms <= 0) return { text: "Live now" };
  const left = coverTimeLeft(ms);
  if (!left) return null;
  if (ms >= HOUR_MS) return { text: `Opens in ${left}` };
  return {
    text: `Opens in ${left}`,
    tick: { endsAt: sale.startTime.toISOString(), template: "Opens in {time}" },
  };
}

function rowFor(row: SaleListRow, now: Date): HomeComingUpRow {
  const sale = atgDisplaySale(row.sale, now);
  const deadline = consignmentDeadline(sale, now);
  const hasLots = row.lotCount > 0;
  const typeLabel = deliveryLine(sale);
  const lotsLabel = hasLots ? formatSaleLotsLabel(row.lotCount) : null;
  const meta = [
    typeLabel,
    lotsLabel,
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
    typeLabel,
    lotsLabel,
    image: coverImage(sale),
    time: timeFor(sale, now),
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
  return {
    rows: shown,
    layout: comingUpLayout(shown.length),
    seeAll: { href: "/sales", label: "Auction calendar" },
  };
}
