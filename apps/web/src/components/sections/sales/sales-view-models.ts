import type { SaleCardCommon } from "@/components/sections/sales/card/types";
import { atgDisplaySale } from "@/lib/catalog/atg-catalog-display";
import {
  formatLondonDateRange,
  formatLondonTimeWithZone,
  formatLondonWeekday,
  londonDayKey,
} from "@/lib/datetime/london-time";
import { formatMoney } from "@/lib/format-currency";
import { type SaleListRow, formatSaleItemsLabel, formatSaleLotsLabel } from "@/lib/sale-list-row";
import { saleMarketingLocationLabel } from "@/lib/sale-location-label";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import { salePath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";
import { toDisplayDate, toOptionalIsoString, toSaleCountdownEndIso } from "@auction/validators";

export type { SaleCardCommon } from "@/components/sections/sales/card/types";

export type SaleCalendarCardVM = {
  id: string;
  href: string;
  title: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  /** Date range in London time, e.g. "9–16 Apr 2026". */
  dateRangeLabel: string;
  /** Start time in London time with its zone, e.g. "11:00 GMT". */
  timeLabel: string;
  /** Combined line for JSON-LD / legacy consumers. */
  dateLabel: string;
  auctionTypeLabel: string;
  status: Sale["status"];
  itemsLabel: string;
  locationLabel: string | null;
  /** ISO timestamp for live sale countdown (sale end). */
  countdownEndIso?: string;
  /** ISO end instant for reactive countdown self-heal on long-open pages. */
  endTimeIso?: string;
  categoryLabel?: string;
  resultsSummary?: { hammer?: string; total?: string };
  deliveryMode: Sale["deliveryMode"];
};

function mapDeliveryToAuctionTypeLabel(mode: Sale["deliveryMode"]): string {
  return getSaleTypePresentation(mode).title;
}

function endedHammerTotal(lots: Lot[]): string | undefined {
  if (lots.length === 0) return undefined;
  const total = lots.reduce((acc, l) => {
    if (l.status !== "ended" || !l.winnerId) return acc;
    const n = Number.parseFloat(l.currentPrice);
    return acc + (Number.isNaN(n) ? 0 : n);
  }, 0);
  if (total <= 0) return undefined;
  return formatMoney(String(total));
}

function deriveCategoryLabel(sale: Sale): string | undefined {
  const candidate = (sale as unknown as { categoryLabel?: string }).categoryLabel;
  return candidate?.trim() || undefined;
}

export function mapSaleToCalendarCardVM(row: SaleListRow): SaleCalendarCardVM {
  const { lots, lotCount } = row;
  const sale = atgDisplaySale(row.sale);
  const start = toDisplayDate(sale.startTime);
  const end = toDisplayDate(sale.endTime);
  const dateRangeLabel = formatLondonDateRange(start, end);
  const timeLabel = formatLondonTimeWithZone(start);
  const dateLabel = `${dateRangeLabel} · ${timeLabel}`;

  const itemsLabel = formatSaleItemsLabel(lotCount);

  const categoryLabel = deriveCategoryLabel(sale);
  const hammer = sale.status === "ended" ? endedHammerTotal(lots) : undefined;
  const resultsSummary = hammer ? { hammer, total: hammer } : undefined;

  const locationLabel = saleMarketingLocationLabel(sale);
  const countdownEndIso = toSaleCountdownEndIso(sale);
  const endTimeIso = toOptionalIsoString(sale.endTime);

  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    coverImageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: sale.title,
    dateRangeLabel,
    timeLabel,
    dateLabel,
    auctionTypeLabel: mapDeliveryToAuctionTypeLabel(sale.deliveryMode),
    status: sale.status,
    itemsLabel,
    locationLabel,
    deliveryMode: sale.deliveryMode,
    ...(endTimeIso ? { endTimeIso } : {}),
    ...(countdownEndIso ? { countdownEndIso } : {}),
    ...(categoryLabel ? { categoryLabel } : {}),
    ...(resultsSummary ? { resultsSummary } : {}),
  };
}

/** Featured hero card — `calendar.html` trending row. */
export type FeaturedAuctionCardVM = SaleCardCommon & {
  deliveryMode: Sale["deliveryMode"];
  auctionTypeLabel: string;
  /** Schedule line, e.g. "9–16 Apr 2026 · 11:00 GMT". */
  dateLabel: string;
  locationLabel: string | null;
  itemsLabel: string;
};

/** Browse row — horizontal list on large screens, stacked mobile-first. */
export type SaleAuctionRowVM = SaleCardCommon & {
  lotsHref: string;
  /** First line: bold segment + remainder, e.g. type "Online Auction " + "| 9–16 April …". */
  scheduleLead: string;
  scheduleRest: string;
  auctionTypeLine: string;
  itemsLabel: string;
  showRegisterButton: boolean;
};

/** Calendar browse grid tile — compact card with items + register parity vs row view. */
export type CalendarGridCardVM = FeaturedAuctionCardVM & {
  lotsHref: string;
  showRegisterButton: boolean;
};

/** Row schedule: "Online auction " + "· 9–16 Apr 2026 · 11:00 BST". */
function buildRowScheduleParts(sale: Sale): { lead: string; rest: string } {
  const start = toDisplayDate(sale.startTime);
  const end = toDisplayDate(sale.endTime);
  const type = mapDeliveryToAuctionTypeLabel(sale.deliveryMode);
  return {
    lead: `${type} `,
    rest: `· ${formatLondonDateRange(start, end)} · ${formatLondonTimeWithZone(start)}`,
  };
}

export function mapSaleToFeaturedAuctionCardVM(row: SaleListRow): FeaturedAuctionCardVM {
  const base = mapSaleToCalendarCardVM(row);
  return {
    id: base.id,
    href: base.href,
    title: base.title,
    coverImageUrl: base.coverImageUrl,
    coverImageAlt: base.coverImageAlt,
    auctionTypeLabel: base.auctionTypeLabel,
    dateLabel: base.dateLabel,
    locationLabel: base.locationLabel,
    itemsLabel: base.itemsLabel,
    status: base.status,
    deliveryMode: base.deliveryMode,
    ...(base.endTimeIso ? { endTimeIso: base.endTimeIso } : {}),
    ...(base.countdownEndIso ? { countdownEndIso: base.countdownEndIso } : {}),
  };
}

export function mapSaleToCalendarGridCardVM(
  row: SaleListRow,
  opts: { showRegisterButton: boolean },
): CalendarGridCardVM {
  const featured = mapSaleToFeaturedAuctionCardVM(row);
  return {
    ...featured,
    lotsHref: salePath(row.sale),
    showRegisterButton: opts.showRegisterButton,
  };
}

/** Agenda row for the month/calendar view — date chip + compact schedule line. */
export type SaleAgendaItemVM = {
  id: string;
  href: string;
  title: string;
  status: Sale["status"];
  /** ISO start used to group rows by month and order within a day. */
  startIso: string;
  /** London day of the month, e.g. "9". */
  dayLabel: string;
  /** Short weekday, e.g. "Wed". */
  weekdayLabel: string;
  /** Start time in London time with its zone, e.g. "11:00 GMT". */
  timeLabel: string;
  auctionTypeLabel: string;
  itemsLabel: string;
  locationLabel: string | null;
  deliveryMode: Sale["deliveryMode"];
  endTimeIso?: string;
  /** ISO end for the live-sale countdown. */
  countdownEndIso?: string;
};

export function mapSaleToAgendaItemVM(row: SaleListRow): SaleAgendaItemVM {
  const { lotCount } = row;
  const sale = atgDisplaySale(row.sale);
  const start = toDisplayDate(sale.startTime);
  const countdownEndIso = toSaleCountdownEndIso(sale);
  const startIso = toOptionalIsoString(sale.startTime) ?? "";
  const endTimeIso = toOptionalIsoString(sale.endTime);
  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    status: sale.status,
    deliveryMode: sale.deliveryMode,
    startIso,
    dayLabel: String(Number(londonDayKey(start).slice(8, 10))),
    weekdayLabel: formatLondonWeekday(start),
    timeLabel: formatLondonTimeWithZone(start),
    auctionTypeLabel: mapDeliveryToAuctionTypeLabel(sale.deliveryMode),
    itemsLabel: formatSaleLotsLabel(lotCount),
    locationLabel: saleMarketingLocationLabel(sale),
    ...(endTimeIso ? { endTimeIso } : {}),
    ...(countdownEndIso ? { countdownEndIso } : {}),
  };
}

export function mapSaleToAuctionRowVM(
  row: SaleListRow,
  opts: { showRegisterButton: boolean },
): SaleAuctionRowVM {
  const { lotCount } = row;
  const sale = atgDisplaySale(row.sale);
  const { lead, rest } = buildRowScheduleParts(sale);
  const itemsLabel = formatSaleItemsLabel(lotCount);
  const countdownEndIso = toSaleCountdownEndIso(sale);
  const endTimeIso = toOptionalIsoString(sale.endTime);

  return {
    id: sale.id,
    href: salePath(sale),
    lotsHref: salePath(sale),
    title: sale.title,
    coverImageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: sale.title,
    scheduleLead: lead,
    scheduleRest: rest,
    auctionTypeLine: mapDeliveryToAuctionTypeLabel(sale.deliveryMode),
    itemsLabel,
    status: sale.status,
    showRegisterButton: opts.showRegisterButton,
    deliveryMode: sale.deliveryMode,
    ...(endTimeIso ? { endTimeIso } : {}),
    ...(countdownEndIso ? { countdownEndIso } : {}),
  };
}
