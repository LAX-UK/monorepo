import { formatEstimateRange, formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import { formatSaleLotsLabel } from "@/lib/sale-list-row";
import { saleMarketingLocationLabel } from "@/lib/sale-location-label";
import { resolveSaleStreamContext } from "@/lib/sale-stream-policy";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import { salePath } from "@/lib/seo/url";
import type { BuyerPremiumTier, Lot, Sale } from "@auction/types";
import { toLotCardTimingVM, toSaleCardTimingVM, toSaleCountdownEndIso } from "@auction/validators";
import {
  buildGoogleMapsEmbedUrl,
  formatPostalAddressLines,
  hasStructuredAddress,
  isSaleroomDeliveryMode,
  resolveOnsiteMapUrl,
} from "@auction/validators";
import type {
  EndedSaleSummaryVM,
  RelatedSaleVM,
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

function formatBuyerPremiumDisplay(rate: string, tiers: BuyerPremiumTier[] | null): string {
  if (tiers && tiers.length > 0) {
    return "Tiered — see table";
  }
  const n = Number.parseFloat(rate);
  if (Number.isFinite(n) && n > 0 && n <= 1) {
    return `${Math.round(n * 100)}%`;
  }
  return rate;
}

export function formatBuyerPremiumTierLabel(tier: BuyerPremiumTier, currency = "GBP"): string {
  const thresholdMajor = tier.hammerThresholdMinor / 100;
  const ratePct = Math.round(Number.parseFloat(tier.rate) * 100);
  const thresholdLabel =
    thresholdMajor <= 0
      ? "All hammer prices"
      : `From ${formatMoney(String(thresholdMajor), currency)}`;
  return `${thresholdLabel}: ${ratePct}%`;
}

/** Aggregate estimate range across lots when the full catalogue is loaded. */
export function aggregateSaleEstimateTotal(
  lots: Lot[],
  opts: { loadedCount: number; totalLots: number },
): string | null {
  if (opts.loadedCount !== opts.totalLots || lots.length !== opts.totalLots) return null;

  let currency: string | null = null;
  let lowSum = 0;
  let highSum = 0;
  let withEstimate = 0;

  for (const lot of lots) {
    const est = lot.marketingDetails?.estimate;
    if (!est?.low || !est?.high || !est.currency) continue;
    const low = Number.parseFloat(est.low);
    const high = Number.parseFloat(est.high);
    if (!Number.isFinite(low) || !Number.isFinite(high)) continue;
    if (currency && est.currency !== currency) return null;
    currency = est.currency;
    lowSum += low;
    highSum += high;
    withEstimate += 1;
  }

  if (!currency || withEstimate === 0) return null;

  try {
    const range = formatEstimateRange({ low: String(lowSum), high: String(highSum), currency });
    if (withEstimate < lots.length) {
      return `${range} (from ${withEstimate} lots)`;
    }
    return range;
  } catch {
    return null;
  }
}

/** Ended-sale aggregates from loaded lots (accurate when full catalogue is present). */
export function computeEndedSaleSummary(
  sale: Sale,
  lots: Lot[],
  opts: { loadedCount: number; totalLots: number },
): EndedSaleSummaryVM | null {
  if (sale.status !== "ended" || lots.length === 0) return null;

  const allLoaded = opts.loadedCount === opts.totalLots && lots.length === opts.totalLots;
  const endedLots = lots.filter((l) => l.status === "ended");
  const soldLots = endedLots.filter((l) => l.winnerId);
  const unsoldCount = endedLots.length - soldLots.length;

  let hammerSum = 0;
  let currency: string | null = null;
  for (const lot of soldLots) {
    const price = Number.parseFloat(lot.currentPrice);
    if (!Number.isFinite(price)) continue;
    const lotCurrency = resolveLotCurrency(lot);
    if (currency && lotCurrency !== currency) {
      currency = null;
      break;
    }
    currency = lotCurrency;
    hammerSum += price;
  }

  const hammerTotalLabel =
    currency && soldLots.length > 0
      ? formatMoney(String(hammerSum), currency)
      : soldLots.length > 0
        ? "—"
        : formatMoney("0", currency ?? "GBP");

  return {
    soldCount: soldLots.length,
    unsoldCount,
    hammerTotalLabel,
    ...(!allLoaded
      ? {
          partialLabel: `Based on ${lots.length} of ${opts.totalLots} lots loaded.`,
        }
      : {}),
  };
}

function saleStartsSoon(sale: Sale, now: Date): boolean {
  if (sale.status !== "scheduled") return false;
  const startMs = sale.startTime.getTime();
  const nowMs = now.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Number.isFinite(startMs) && startMs > nowMs && startMs <= nowMs + sevenDaysMs;
}

function formatDeliveryModeLabel(sale: Sale): string {
  return getSaleTypePresentation(sale.deliveryMode).label;
}

function saleTags(sale: Sale): string[] {
  const tags: string[] = [];
  const pres = getSaleTypePresentation(sale.deliveryMode);
  tags.push(pres.label);
  const streamCtx = resolveSaleStreamContext(sale);
  if (streamCtx.presentation?.overviewTag) tags.push(streamCtx.presentation.overviewTag);
  return tags;
}

export function mapSaleToHeroVM(
  sale: Sale,
  opts: {
    totalLots: number;
    shareUrl: string;
    now: Date;
    /** Optional precomputed live lot count (used by the hero kicker). */
    liveLotsCount?: number;
    /** Optional formatted estimated total for the third hero stat. */
    estimatedTotalLabel?: string;
    /** Masked registered bidder count from API. */
    registeredBidderCount?: number;
  },
): SaleHeroVM {
  const isLive = sale.status === "active";
  const dateLine = formatHeroDateLine(sale);
  const isScheduled = sale.status === "scheduled";

  const registrationClosesShort =
    isScheduled && sale.previewStartTime
      ? formatRelativeShort(sale.previewStartTime, opts.now)
      : null;
  const leftColumnLabel: "Preview opens" | null =
    isScheduled && sale.previewStartTime ? "Preview opens" : null;

  let biddingStartsShort: string | null = null;
  let rightColumnLabel: "Bidding starts" | null = null;
  if (isScheduled) {
    biddingStartsShort = formatRelativeShort(sale.startTime, opts.now);
    rightColumnLabel = "Bidding starts";
  }

  return {
    id: sale.id,
    title: sale.title,
    coverImage: sale.coverImages[0] ?? null,
    startEndLabel: formatSaleDateLabel(sale.startTime, sale.endTime),
    ...toSaleCardTimingVM(sale),
    isLive,
    shareUrl: opts.shareUrl,
    itemsLabel: formatSaleLotsLabel(opts.totalLots),
    dateLine,
    registrationClosesShort,
    biddingStartsShort,
    leftColumnLabel,
    rightColumnLabel,
    ...(typeof opts.liveLotsCount === "number" ? { liveLotsCount: opts.liveLotsCount } : {}),
    ...(opts.estimatedTotalLabel ? { estimatedTotalLabel: opts.estimatedTotalLabel } : {}),
    ...(typeof opts.registeredBidderCount === "number"
      ? { registeredBidderCount: opts.registeredBidderCount }
      : {}),
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
    lotNumber: lot.lotNumber,
    lotLabel: lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null,
    title: lot.title,
    imageUrl: lot.images[0] ?? null,
    imageAlt: lot.title,
    estimateValue: estimate,
    currentBidLabel: lot.status === "ended" ? "Final bid" : "Current bid",
    currentBidValue: formatMoney(lot.currentPrice, resolveLotCurrency(lot)),
    bidsCountLabel: null,
    closingLabel: lot.status === "active" ? formatLongDateTime(lot.endTime) : null,
    closingShort,
    isLive: lot.status === "active",
    viewerOwnsLot: opts.viewerUserId ? lot.sellerId === opts.viewerUserId : false,
    artistOrMedium: lotSubtitle(lot),
    viewerIsWatching: Boolean(opts.initialWatching),
    winnerId: lot.winnerId,
    ...toLotCardTimingVM(lot),
  };
}

export function mapSaleToRelatedVM(sale: Sale, lotCount: number, now = new Date()): RelatedSaleVM {
  const dateLabel = formatSaleDateLabel(sale.startTime, sale.endTime);
  const isLive = sale.status === "active";
  const countdownEndIso = toSaleCountdownEndIso(sale);
  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    kindLabel: getSaleTypePresentation(sale.deliveryMode).title,
    dateLabel,
    dateLine: dateLabel.toUpperCase(),
    itemsLabel: formatSaleLotsLabel(lotCount),
    imageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: `${sale.title} — auction cover`,
    status: sale.status,
    deliveryMode: sale.deliveryMode,
    isLive,
    startsSoon: saleStartsSoon(sale, now),
    countdownEndIso: countdownEndIso ?? null,
    locationLabel: saleMarketingLocationLabel(sale),
  };
}

export function mapSaleToOverviewVM(
  sale: Sale,
  opts: {
    categoryLabel: string | null;
    categoryLabels?: string[];
    endedSaleSummary?: EndedSaleSummaryVM | null;
  },
): SaleOverviewVM {
  const formatLabel = formatDeliveryModeLabel(sale);
  const tags = saleTags(sale).filter((tag) => tag !== formatLabel && tag !== "Live stream");
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
  const showLocation = isSaleroomDeliveryMode(sale.deliveryMode) && hasAnyLocationInfo;
  const categoryLabels = opts.categoryLabels ?? (opts.categoryLabel ? [opts.categoryLabel] : []);
  return {
    status: sale.status,
    description: sale.description,
    startLabel: formatLongDateTime(sale.startTime),
    endLabel: formatLongDateTime(sale.endTime),
    previewLabel: sale.previewStartTime ? formatLongDateTime(sale.previewStartTime) : null,
    formatLabel,
    buyerPremiumLabel: formatBuyerPremiumDisplay(sale.buyerPremiumRate, sale.buyerPremiumTiers),
    buyerPremiumTiers: sale.buyerPremiumTiers,
    categoryLabel: opts.categoryLabel,
    categoryLabels,
    tags,
    ...(() => {
      const streamCtx = resolveSaleStreamContext({
        streamUrl: sale.streamUrl,
        status: sale.status,
        deliveryMode: sale.deliveryMode,
        saleTitle: sale.title,
        endTime: sale.endTime,
      });
      return {
        streamUrl: sale.streamUrl,
        showSalePageStream: streamCtx.showOnSalePage,
        streamPresentation: streamCtx.presentation,
      };
    })(),
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
    ...(opts.endedSaleSummary ? { endedSaleSummary: opts.endedSaleSummary } : {}),
  };
}
