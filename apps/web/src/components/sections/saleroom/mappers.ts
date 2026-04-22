import { formatMoney } from "@/lib/format-currency";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import type { Lot, Sale } from "@auction/types";
import type { BidderRowVM, RelatedSaleVM, SaleHeroVM, SaleLotCardVM } from "./view-models";

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};
const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

export function formatSaleDateLabel(start: Date, end: Date): string {
  const sameDay = start.toDateString() === end.toDateString();
  const d = (x: Date) => x.toLocaleDateString(undefined, DATE_OPTS);
  return sameDay ? d(start) : `${d(start)} – ${d(end)}`;
}

export function formatLongDateTime(d: Date): string {
  return `${d.toLocaleDateString(undefined, DATE_OPTS)} · ${d.toLocaleTimeString(undefined, TIME_OPTS)}`;
}

/** Relative short copy e.g. "10 days" for UI rows (not "in 10 days"). */
export function formatRelativeShort(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  const absDays = Math.abs(Math.round(ms / (24 * 60 * 60 * 1000)));
  if (absDays >= 1) {
    return `${absDays} ${absDays === 1 ? "day" : "days"}`;
  }
  const absHours = Math.abs(Math.round(ms / (60 * 60 * 1000)));
  if (absHours >= 1) {
    return `${absHours} ${absHours === 1 ? "hour" : "hours"}`;
  }
  return "Soon";
}

/** One uppercased line: date range | time (no location — none on `Sale`). */
export function formatHeroDateLine(sale: Sale): string {
  const range = formatSaleDateLabel(sale.startTime, sale.endTime);
  const time = sale.startTime.toLocaleTimeString(undefined, TIME_OPTS);
  return `${range} | ${time}`.toUpperCase();
}

export function mapSaleToHeroVM(
  sale: Sale,
  opts: { totalLots: number; shareUrl: string; now: Date },
): SaleHeroVM {
  const tags: string[] = [];
  if (sale.deliveryMode === "online") tags.push("Online");
  else if (sale.deliveryMode === "hybrid") tags.push("Hybrid");
  else tags.push("Onsite");
  if (sale.streamUrl) tags.push("Live stream");

  const isLive = sale.status === "active";
  const dateLine = formatHeroDateLine(sale);

  const registrationClosesShort =
    sale.status === "scheduled" ? formatRelativeShort(sale.startTime, opts.now) : null;
  const biddingStartsShort =
    sale.status === "scheduled" ? formatRelativeShort(sale.startTime, opts.now) : null;

  return {
    id: sale.id,
    title: sale.title,
    coverImage: sale.coverImages[0] ?? null,
    startEndLabel: formatSaleDateLabel(sale.startTime, sale.endTime),
    status: sale.status,
    isLive,
    registrationClosesLabel:
      sale.status === "scheduled" ? formatLongDateTime(sale.startTime) : null,
    biddingStartsLabel: isLive ? null : formatLongDateTime(sale.startTime),
    description: sale.description,
    shareUrl: opts.shareUrl,
    itemsLabel: `${opts.totalLots} ${opts.totalLots === 1 ? "lot" : "lots"}`,
    tags,
    dateLine,
    registrationClosesShort,
    biddingStartsShort,
    liveLabel: "Live Auction",
  };
}

function lotSubtitle(lot: Lot): string | null {
  if (lot.medium?.trim()) return lot.medium.trim();
  return null;
}

export function mapLotToCardVM(
  lot: Lot,
  opts: { viewerUserId: string | null; now: Date; initialWatching?: boolean },
): SaleLotCardVM {
  const estimate = lotEstimateLine(lot);
  const closingShort =
    lot.status === "active" || lot.status === "scheduled"
      ? formatRelativeShort(lot.endTime, opts.now)
      : null;
  return {
    id: lot.id,
    href: `/artwork/${lot.id}`,
    lotLabel: lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null,
    title: lot.title,
    imageUrl: lot.images[0] ?? null,
    imageAlt: lot.title,
    estimateValue: estimate,
    currentBidLabel: lot.status === "ended" ? "Final bid" : "Current bid",
    currentBidValue: formatMoney(lot.currentPrice),
    bidsCountLabel: null,
    closingLabel: lot.status === "active" ? formatLongDateTime(lot.endTime) : null,
    closingShort,
    isLive: lot.status === "active",
    viewerOwnsLot: opts.viewerUserId ? lot.sellerId === opts.viewerUserId : false,
    artistOrMedium: lotSubtitle(lot),
    viewerIsWatching: Boolean(opts.initialWatching),
  };
}

export function mapSaleToRelatedVM(sale: Sale, lotCount: number): RelatedSaleVM {
  const dateLabel = formatSaleDateLabel(sale.startTime, sale.endTime);
  return {
    id: sale.id,
    href: `/sales/${sale.id}`,
    title: sale.title,
    kindLabel:
      sale.deliveryMode === "online"
        ? "Online auction"
        : sale.deliveryMode === "hybrid"
          ? "Hybrid auction"
          : "Live auction",
    dateLabel,
    dateLine: dateLabel.toUpperCase(),
    itemsLabel: `${lotCount} ${lotCount === 1 ? "lot" : "lots"}`,
    imageUrl: sale.coverImages[0] ?? null,
  };
}

export function mapBidderRowVM(row: { maskedName: string; firstBidAt: Date }): BidderRowVM {
  return {
    maskedName: row.maskedName,
    joinedLabel: row.firstBidAt.toLocaleDateString(undefined, DATE_OPTS),
  };
}
