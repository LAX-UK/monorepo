import type { Lot, Sale } from "@auction/types";

export type SaleCalendarRowVM = {
  id: string;
  href: string;
  title: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  dateLabel: string;
  auctionTypeLabel: string;
  itemsLabel: string;
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

  return {
    id: sale.id,
    href: `/sales/${sale.id}`,
    title: sale.title,
    coverImageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: sale.title,
    dateLabel,
    auctionTypeLabel: mapDeliveryToAuctionTypeLabel(sale.deliveryMode),
    itemsLabel,
  };
}
