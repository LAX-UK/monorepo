import type { SaleCardCommon } from "@/components/sections/sales/card/types";
import { formatMoney } from "@/lib/format-currency";
import { saleMarketingLocationLabel } from "@/lib/sale-location-label";
import { salePath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";

export type { SaleCardCommon } from "@/components/sections/sales/card/types";

export type SaleCalendarCardVM = {
  id: string;
  href: string;
  title: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  /** Uppercased date range only, e.g. "9–16 APRIL 2026". */
  dateRangeLabel: string;
  /** Uppercased start time with zone, e.g. "11:00 AM GMT". */
  timeLabel: string;
  /** Combined line for JSON-LD / legacy consumers. */
  dateLabel: string;
  auctionTypeLabel: string;
  status: Sale["status"];
  itemsLabel: string;
  locationLabel: string | null;
  /** ISO timestamp for live sale countdown (sale end). */
  countdownEndIso?: string;
  categoryLabel?: string;
  resultsSummary?: { hammer?: string; total?: string };
};

function formatTimeLine(start: Date, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(start);
}

function formatDateRangeLine(start: Date, end: Date, locale = "en-GB"): string {
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.getMonth();
  const endMonth = end.getMonth();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  const mon = new Intl.DateTimeFormat(locale, { month: "long" });
  if (startYear === endYear && startMonth === endMonth && startDay === endDay) {
    return `${startDay} ${mon.format(start)} ${startYear}`;
  }
  if (startYear === endYear && startMonth === endMonth) {
    return `${startDay}–${endDay} ${mon.format(start)} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${startDay} ${mon.format(start)} – ${endDay} ${mon.format(end)} ${startYear}`;
  }
  return `${startDay} ${mon.format(start)} ${startYear} – ${endDay} ${mon.format(end)} ${endYear}`;
}

function mapDeliveryToAuctionTypeLabel(mode: Sale["deliveryMode"]): string {
  switch (mode) {
    case "online":
      return "Online Auction";
    case "onsite":
      return "Live Auction";
  }
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

export function mapSaleToCalendarCardVM(
  sale: Sale,
  lots: Lot[],
  listLocale = "en-GB",
): SaleCalendarCardVM {
  const start = new Date(sale.startTime);
  const end = new Date(sale.endTime);
  const dateRangeLabel = formatDateRangeLine(start, end, listLocale).toUpperCase();
  const timeLabel = formatTimeLine(start, listLocale).toUpperCase();
  const dateLabel = `${dateRangeLabel} | ${timeLabel}`;

  const n = lots.length;
  const itemsLabel = `${n} Item${n === 1 ? "" : "s"}`;

  const categoryLabel = deriveCategoryLabel(sale);
  const hammer = sale.status === "ended" ? endedHammerTotal(lots) : undefined;
  const resultsSummary = hammer ? { hammer, total: hammer } : undefined;

  const locationLabel = saleMarketingLocationLabel(sale);
  const countdownEndIso =
    sale.status === "active" ? new Date(sale.endTime).toISOString() : undefined;

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
    ...(countdownEndIso ? { countdownEndIso } : {}),
    ...(categoryLabel ? { categoryLabel } : {}),
    ...(resultsSummary ? { resultsSummary } : {}),
  };
}

/** Featured hero card — `calendar.html` trending row. */
export type FeaturedAuctionCardVM = SaleCardCommon & {
  auctionTypeLabel: string;
  /** Uppercase schedule line, e.g. "9–16 APRIL 2026 | 11:00 AM GMT". */
  dateLabel: string;
  locationLabel: string | null;
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

function formatDateRangeHyphenCase(start: Date, end: Date, locale = "en-GB"): string {
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.getMonth();
  const endMonth = end.getMonth();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const mon = new Intl.DateTimeFormat(locale, { month: "long" });
  if (startYear === endYear && startMonth === endMonth && startDay === endDay) {
    return `${startDay}-${mon.format(start)} ${startYear}`;
  }
  if (startYear === endYear && startMonth === endMonth) {
    return `${startDay}-${endDay} ${mon.format(start)} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${startDay} ${mon.format(start)} – ${endDay} ${mon.format(end)} ${startYear}`;
  }
  return `${startDay} ${mon.format(start)} ${startYear} – ${endDay} ${mon.format(end)} ${endYear}`;
}

function formatTimeLineShort(start: Date, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(start);
}

/** Row schedule: "Online Auction " + "| 9-16 April 2026 | 11 AM BST" style. */
function buildRowScheduleParts(
  sale: Sale,
  _lots: Lot[],
  listLocale = "en-GB",
): { lead: string; rest: string } {
  const start = new Date(sale.startTime);
  const end = new Date(sale.endTime);
  const datePart = formatDateRangeHyphenCase(start, end, listLocale);
  const timePart = formatTimeLineShort(start, listLocale);
  const type = mapDeliveryToAuctionTypeLabel(sale.deliveryMode);
  return {
    lead: `${type} `,
    rest: `| ${datePart} | ${timePart}`,
  };
}

export function mapSaleToFeaturedAuctionCardVM(
  sale: Sale,
  lots: Lot[],
  listLocale = "en-GB",
): FeaturedAuctionCardVM {
  const base = mapSaleToCalendarCardVM(sale, lots, listLocale);
  return {
    id: base.id,
    href: base.href,
    title: base.title,
    coverImageUrl: base.coverImageUrl,
    coverImageAlt: base.coverImageAlt,
    auctionTypeLabel: base.auctionTypeLabel,
    dateLabel: base.dateLabel,
    locationLabel: base.locationLabel,
    status: base.status,
    ...(base.countdownEndIso ? { countdownEndIso: base.countdownEndIso } : {}),
  };
}

export function mapSaleToAuctionRowVM(
  sale: Sale,
  lots: Lot[],
  opts: { showRegisterButton: boolean },
  listLocale = "en-GB",
): SaleAuctionRowVM {
  const { lead, rest } = buildRowScheduleParts(sale, lots, listLocale);
  const n = lots.length;
  const itemsLabel = `${n} Item${n === 1 ? "" : "s"}`;
  const countdownEndIso =
    sale.status === "active" ? new Date(sale.endTime).toISOString() : undefined;

  return {
    id: sale.id,
    href: salePath(sale),
    lotsHref: salePath(sale),
    title: sale.title,
    coverImageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: sale.title,
    scheduleLead: lead,
    scheduleRest: rest,
    auctionTypeLine: mapDeliveryToAuctionTypeLabel(sale.deliveryMode).toUpperCase(),
    itemsLabel,
    status: sale.status,
    showRegisterButton: opts.showRegisterButton,
    ...(countdownEndIso ? { countdownEndIso } : {}),
  };
}
