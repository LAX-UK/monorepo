import { formatMoney } from "@/lib/format-currency";
import { salePath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";

export type SaleCalendarRowVM = {
  id: string;
  href: string;
  title: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  dateLabel: string;
  auctionTypeLabel: string;
  status: Sale["status"];
  itemsLabel: string;
  /**
   * Optional category label (e.g. "Modern & Contemporary"). When present
   * appended to the meta line; absent leaves current rendering unchanged.
   */
  categoryLabel?: string;
  /**
   * Optional results summary for past sales. When present, the row appends a
   * "{hammer} hammer · {total} total" suffix. Both halves are individually
   * optional so partial data (only `hammer` or only `total`) renders cleanly.
   */
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

/**
 * Build the calendar row label line, e.g. "9–16 April 2026 | 11 AM GMT | London".
 * Location is optional (no field on Sale yet per plan).
 */
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

export function mapSaleToCalendarRowVM(
  sale: Sale,
  lots: Lot[],
  listLocale = "en-GB",
): SaleCalendarRowVM {
  const start = new Date(sale.startTime);
  const end = new Date(sale.endTime);
  const range = formatDateRangeLine(start, end, listLocale);
  const timePart = formatTimeLine(start, listLocale);
  const dateLabel = `${range} | ${timePart}`.toUpperCase();

  const n = lots.length;
  const itemsLabel = `${n} Item${n === 1 ? "" : "s"}`;

  const categoryLabel = deriveCategoryLabel(sale);
  const hammer = sale.status === "ended" ? endedHammerTotal(lots) : undefined;
  const resultsSummary = hammer ? { hammer, total: hammer } : undefined;

  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    coverImageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: sale.title,
    dateLabel,
    auctionTypeLabel: mapDeliveryToAuctionTypeLabel(sale.deliveryMode),
    status: sale.status,
    itemsLabel,
    ...(categoryLabel ? { categoryLabel } : {}),
    ...(resultsSummary ? { resultsSummary } : {}),
  };
}
