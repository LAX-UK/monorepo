import { formatMoney } from "@/lib/format-currency";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import { saleMarketingLocationLabel } from "@/lib/sale-location-label";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import { salePath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";
import {
  buildGoogleMapsEmbedUrl,
  formatPostalAddressLines,
  hasStructuredAddress,
  resolveOnsiteMapUrl,
} from "@auction/validators";
import type {
  RelatedSaleVM,
  SaleHeroStatusBadge,
  SaleHeroVM,
  SaleLotCardVM,
  SaleOverviewVM,
} from "./view-models";

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

function heroLocationSegment(sale: Sale): string | null {
  return saleMarketingLocationLabel(sale);
}

/** Uppercased line: date range | time | location or format (from `Sale`). */
export function formatHeroDateLine(sale: Sale): string {
  const range = formatSaleDateLabel(sale.startTime, sale.endTime);
  const time = sale.startTime.toLocaleTimeString(undefined, TIME_OPTS);
  const loc = heroLocationSegment(sale);
  const tail = loc ? ` | ${loc}` : "";
  return `${range} | ${time}${tail}`.toUpperCase();
}

function formatBuyerPremiumDisplay(rate: string): string {
  const n = Number.parseFloat(rate);
  if (Number.isFinite(n) && n > 0 && n <= 1) {
    return `${Math.round(n * 100)}%`;
  }
  return rate;
}

function formatDeliveryModeLabel(sale: Sale): string {
  return getSaleTypePresentation(sale.deliveryMode).label;
}

function saleTags(sale: Sale): string[] {
  const tags: string[] = [];
  const pres = getSaleTypePresentation(sale.deliveryMode);
  tags.push(pres.label);
  if (sale.streamUrl) tags.push("Live stream");
  return tags;
}

function buildHeroOverviewMetaLine(sale: Sale, categoryLabel: string | null): string | null {
  const mode = formatDeliveryModeLabel(sale);
  const premium = formatBuyerPremiumDisplay(sale.buyerPremiumRate);
  const parts = [mode, premium];
  if (categoryLabel?.trim()) parts.push(categoryLabel.trim());
  return parts.join(" · ");
}

export function mapSaleToHeroVM(
  sale: Sale,
  opts: {
    totalLots: number;
    shareUrl: string;
    now: Date;
    categoryLabel: string | null;
    /** Optional precomputed live lot count (used by the hero kicker). */
    liveLotsCount?: number;
    /** Optional formatted estimated total for the third hero stat. */
    estimatedTotalLabel?: string;
  },
): SaleHeroVM {
  const tags = saleTags(sale);
  const isLive = sale.status === "active";
  const dateLine = formatHeroDateLine(sale);
  const overviewMetaLine = buildHeroOverviewMetaLine(sale, opts.categoryLabel);

  const registrationClosesShort = sale.previewStartTime
    ? formatRelativeShort(sale.previewStartTime, opts.now)
    : null;
  const leftColumnLabel: "Preview opens" | null = sale.previewStartTime ? "Preview opens" : null;

  let biddingStartsShort: string | null = null;
  let rightColumnLabel: "Bidding" | "Bidding starts" | null = null;
  if (sale.status === "active") {
    biddingStartsShort = "Live now";
    rightColumnLabel = "Bidding";
  } else if (sale.status === "scheduled") {
    biddingStartsShort = formatRelativeShort(sale.startTime, opts.now);
    rightColumnLabel = "Bidding starts";
  }

  const statusBadge: SaleHeroStatusBadge =
    sale.status === "active"
      ? { kind: "live", label: "Live Auction" }
      : sale.status === "scheduled"
        ? { kind: "upcoming", label: "Upcoming Auction" }
        : sale.status === "ended"
          ? { kind: "ended", label: "Ended" }
          : null;

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
    leftColumnLabel,
    rightColumnLabel,
    overviewMetaLine,
    liveLabel: "Live Auction",
    statusBadge,
    ...(typeof opts.liveLotsCount === "number" ? { liveLotsCount: opts.liveLotsCount } : {}),
    ...(opts.estimatedTotalLabel ? { estimatedTotalLabel: opts.estimatedTotalLabel } : {}),
  };
}

function lotSubtitle(lot: Lot): string | null {
  if (lot.medium?.trim()) return lot.medium.trim();
  return null;
}

export function mapLotToCardVM(
  lot: Lot,
  opts: {
    viewerUserId: string | null;
    now: Date;
    initialWatching?: boolean;
    catalogLinkParams?: CatalogLinkParams;
  },
): SaleLotCardVM {
  const estimate = lotEstimateLine(lot);
  // Server-rendered relative phrase used as a non-ticking secondary line.
  // Important: scheduled lots count down to start (opens-in), active lots to end (closes-in).
  const closingShort =
    lot.status === "active"
      ? formatRelativeShort(lot.endTime, opts.now)
      : lot.status === "scheduled"
        ? formatRelativeShort(lot.startTime, opts.now)
        : null;
  return {
    id: lot.id,
    href: lotCatalogHref(lot, opts.catalogLinkParams),
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
    status: lot.status,
    startTime: lot.startTime.toISOString(),
    endTime: lot.endTime.toISOString(),
  };
}

export function mapSaleToRelatedVM(sale: Sale, lotCount: number): RelatedSaleVM {
  const dateLabel = formatSaleDateLabel(sale.startTime, sale.endTime);
  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    kindLabel: getSaleTypePresentation(sale.deliveryMode).title,
    dateLabel,
    dateLine: dateLabel.toUpperCase(),
    itemsLabel: `${lotCount} ${lotCount === 1 ? "lot" : "lots"}`,
    imageUrl: sale.coverImages[0] ?? null,
  };
}

export function mapSaleToOverviewVM(
  sale: Sale,
  opts: { lotsTotal: number; categoryLabel: string | null },
): SaleOverviewVM {
  const tags = saleTags(sale);
  const addressLines = formatPostalAddressLines(sale);
  const resolvedMapUrl = resolveOnsiteMapUrl(sale);
  const locationEmbedUrl = buildGoogleMapsEmbedUrl(sale);
  const hasAnyLocationInfo = Boolean(
    sale.locationName ||
      sale.locationAddress ||
      hasStructuredAddress(sale) ||
      addressLines.length > 0 ||
      resolvedMapUrl,
  );
  const showLocation = sale.deliveryMode === "onsite" && hasAnyLocationInfo;
  return {
    description: sale.description,
    startLabel: formatLongDateTime(sale.startTime),
    endLabel: formatLongDateTime(sale.endTime),
    previewLabel: sale.previewStartTime ? formatLongDateTime(sale.previewStartTime) : null,
    formatLabel: formatDeliveryModeLabel(sale),
    buyerPremiumLabel: formatBuyerPremiumDisplay(sale.buyerPremiumRate),
    categoryLabel: opts.categoryLabel,
    lotsLabel: `${opts.lotsTotal} ${opts.lotsTotal === 1 ? "lot" : "lots"}`,
    tags,
    streamUrl: sale.streamUrl,
    showLiveStream: Boolean(
      sale.streamUrl && (sale.status === "active" || sale.status === "scheduled"),
    ),
    saleTitle: sale.title,
    streamPosterUrl: sale.coverImages[0] ?? null,
    terms: sale.terms,
    locationName: sale.locationName,
    locationAddress: sale.locationAddress,
    locationMapUrl: sale.locationMapUrl,
    locationAddressLines: addressLines,
    resolvedMapUrl,
    locationEmbedUrl,
    showLocation,
  };
}
