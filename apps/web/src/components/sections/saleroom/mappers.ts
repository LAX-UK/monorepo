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

export function mapSaleToHeroVM(
  sale: Sale,
  opts: { totalLots: number; shareUrl: string },
): SaleHeroVM {
  const tags: string[] = [];
  if (sale.deliveryMode === "online") tags.push("Online");
  else if (sale.deliveryMode === "hybrid") tags.push("Hybrid");
  else tags.push("Onsite");
  if (sale.streamUrl) tags.push("Live stream");

  const isLive = sale.status === "active";
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
  };
}

export function mapLotToCardVM(lot: Lot, opts: { viewerUserId: string | null }): SaleLotCardVM {
  const estimate = lotEstimateLine(lot);
  return {
    id: lot.id,
    href: `/artwork/${lot.id}`,
    lotLabel: lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null,
    title: lot.title,
    imageUrl: lot.images[0] ?? null,
    imageAlt: lot.title,
    estimateLabel: estimate ? `Est. ${estimate}` : null,
    currentBidLabel: lot.status === "ended" ? "Final bid" : "Current bid",
    currentBidValue: formatMoney(lot.currentPrice),
    closingLabel: lot.status === "active" ? formatLongDateTime(lot.endTime) : null,
    isLive: lot.status === "active",
    viewerOwnsLot: opts.viewerUserId ? lot.sellerId === opts.viewerUserId : false,
  };
}

export function mapSaleToRelatedVM(sale: Sale, lotCount: number): RelatedSaleVM {
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
    dateLabel: formatSaleDateLabel(sale.startTime, sale.endTime),
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
