import { mapPressRefToVM } from "@/components/sections/press/mappers";
import { atgLiveBidLabel } from "@/lib/catalog/atg-white-label";
import { formatEstimateRangeWhole } from "@/lib/format-currency";
import { type LotCardLineModel, lotCardLineModel } from "@/lib/lot-card/lot-card-line";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { saleBuyerPremiumCopy } from "@/lib/lot/buyer-premium-copy";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import type {
  DayGalleryVM,
  PressCoverageVM,
  RelatedSaleVM,
  SaleHeroVM,
  SaleLotCardVM,
  SaleOverviewVM,
} from "@/lib/marketing/saleroom/view-models";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { formatSaleLotsLabel } from "@/lib/sale-list-row";
import { saleVenueLabel } from "@/lib/sale-location-label";
import { resolveSaleStreamContext } from "@/lib/sale-stream-policy";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import { salePath } from "@/lib/seo/url";
import {
  LONDON_TIME_ZONE,
  formatDateRange,
  formatTimeWithZone,
  formatWhen,
} from "@auction/datetime";
import { type LotMediaTreatmentIndex, lotMediaTreatment } from "@auction/domain";
import type { Lot, Sale, SaleDayMedia } from "@auction/types";
import { toLotCardTimingVM, toSaleCardTimingVM, toSaleCountdownEndIso } from "@auction/validators";
import {
  buildGoogleMapsEmbedUrl,
  formatPostalAddressLines,
  hasStructuredAddress,
  isSaleroomDeliveryMode,
  resolveOnsiteMapUrl,
} from "@auction/validators";

/** "3–9 Nov 2026", in the sale's zone (London for a sale with none). */
export function formatSaleDateLabel(
  start: Date,
  end: Date,
  zone: string = LONDON_TIME_ZONE,
): string {
  return formatDateRange(start, end, zone);
}

/** "Thu 12 Nov, 21:00 GMT". */
export function formatLongDateTime(d: Date): string {
  return formatWhen(d, LONDON_TIME_ZONE, new Date());
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

/** Hero time line: "29 Oct – 3 Nov 2026 · 21:00 GMT". The place has its own line. */
export function formatHeroDateLine(sale: Sale): string {
  const range = formatSaleDateLabel(sale.startTime, sale.endTime, sale.timeZone);
  const time = formatTimeWithZone(sale.startTime, sale.timeZone);
  return [range, time].join(" · ");
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
    const range = formatEstimateRangeWhole({
      low: String(lowSum),
      high: String(highSum),
      currency,
    });
    if (withEstimate < lots.length) {
      return `${range} (from ${withEstimate} lots)`;
    }
    return range;
  } catch {
    return null;
  }
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
    subtitle: sale.subtitle?.trim() || null,
    coverImage: sale.coverImages[0] ?? null,
    startEndLabel: formatSaleDateLabel(sale.startTime, sale.endTime, sale.timeZone),
    ...toSaleCardTimingVM(sale),
    isLive,
    shareUrl: opts.shareUrl,
    itemsLabel: formatSaleLotsLabel(opts.totalLots),
    lotCount: opts.totalLots,
    formatLabel: getSaleTypePresentation(sale.deliveryMode).label,
    placeLabel: saleVenueLabel(sale),
    dateLine,
    timeZone: sale.timeZone,
    previewOpensIso:
      isScheduled && sale.previewStartTime ? sale.previewStartTime.toISOString() : null,
    registrationClosesShort,
    biddingStartsShort,
    leftColumnLabel,
    rightColumnLabel,
    ...(typeof opts.liveLotsCount === "number" ? { liveLotsCount: opts.liveLotsCount } : {}),
    ...(opts.estimatedTotalLabel ? { estimatedTotalLabel: opts.estimatedTotalLabel } : {}),
    ...(typeof opts.registeredBidderCount === "number"
      ? { registeredBidderCount: opts.registeredBidderCount }
      : {}),
    deliveryMode: sale.deliveryMode,
  };
}

function lotSubtitle(lot: Lot): string | null {
  if (lot.medium?.trim()) return lot.medium.trim();
  return null;
}

/** The words a card says in place of the price for a sale that is selling on ATG. */
function atgCardLine(state: "live" | "ended", lot: Lot): LotCardLineModel {
  const base = { time: "none", startsAt: null, endsAt: null } as const;
  return state === "live"
    ? { ...base, label: "Bidding", value: atgLiveBidLabel() }
    : { ...base, label: "Result", value: lot.hasWinner ? "Sold" : "No sale" };
}

export function mapLotToCardVM(
  lot: Lot,
  opts: {
    viewerUserId: string | null;
    now: Date;
    initialWatching?: boolean;
    catalogLinkParams?: CatalogLinkParams;
    /** Sale is selling on ATG: LAX prices are not the ATG bids, so show where to bid or the result. */
    atgState?: "live" | "ended";
    /** The sale's premium, so a sold lot reads the buyer's price like the lot page. */
    premiumSale?: Pick<Sale, "buyerPremiumRate" | "buyerPremiumTiers">;
    /** How each department shows its lots; left out, every lot is a wall work. */
    treatments?: LotMediaTreatmentIndex;
  },
): SaleLotCardVM {
  const estimate = lotEstimateLine(lot);
  const cardLine = opts.atgState
    ? atgCardLine(opts.atgState, lot)
    : lotCardLineModel(lot, opts.now, {
        ...(opts.premiumSale !== undefined ? { premiumSale: opts.premiumSale } : {}),
      });
  // Quick look and the image overlay read a label and a value: a lot with no price says its
  // outcome as the value.
  const price = cardLine.value
    ? { label: cardLine.label, value: cardLine.value }
    : { label: "Result", value: cardLine.label };
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
    displayStyle: lotMediaTreatment(lot, opts.treatments ?? {}).style,
    estimateValue: estimate,
    currentBidLabel: price.label,
    currentBidValue: price.value,
    cardLine,
    bidsCountLabel: null,
    closingLabel: lot.status === "active" ? formatLongDateTime(lot.endTime) : null,
    closingShort,
    isLive: lot.status === "active",
    viewerOwnsLot: opts.viewerUserId ? lot.sellerId === opts.viewerUserId : false,
    artistOrMedium: lotSubtitle(lot),
    viewerIsWatching: Boolean(opts.initialWatching),
    winnerId: lot.winnerId,
    ...(lot.hasWinner !== undefined ? { hasWinner: lot.hasWinner } : {}),
    ...(lot.resultPending ? { resultPending: true } : {}),
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
    locationLabel: saleVenueLabel(sale),
  };
}

export function mapSaleToOverviewVM(
  sale: Sale,
  opts: {
    categoryLabel: string | null;
    categoryLabels?: string[];
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
    buyerPremiumLabel: saleBuyerPremiumCopy(sale).terms,
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
  };
}

/**
 * Build the view-model for the auction-day gallery section.
 * Returns `null` when the sale is not eligible (not ended, not onsite/hybrid, no photos).
 * Applies alt-text fallback so every image has meaningful alt for SEO + accessibility.
 */
/**
 * Build the view-models for the press coverage section.
 * Returns null when no press links have been added.
 * Extracts display `domain` from the URL hostname and formats `dateLabel`.
 */
export function mapSaleToPressCoverageVM(sale: Sale): PressCoverageVM[] | null {
  if (!sale.pressCoverage || sale.pressCoverage.length === 0) return null;
  return sale.pressCoverage.map((ref) => mapPressRefToVM(ref));
}

function resolveDayMediaSrc(value: string): string {
  return resolveMediaSrc(value) ?? value;
}

function withResolvedDayMediaSrc(item: SaleDayMedia): SaleDayMedia {
  if (item.mediaType === "video") {
    const src = resolveDayMediaSrc(item.src);
    const posterSrc = item.posterSrc ? resolveDayMediaSrc(item.posterSrc) : undefined;
    return { ...item, src, ...(posterSrc ? { posterSrc } : {}) };
  }
  return { ...item, src: resolveDayMediaSrc(item.src) };
}

function buildDayGalleryItems(sale: Sale): SaleDayMedia[] {
  if (sale.dayImageAssets?.length) {
    return sale.dayImageAssets.map(withResolvedDayMediaSrc);
  }
  if (!sale.dayImages?.length) return [];
  return sale.dayImages.map((ref) => {
    if (ref.mediaType === "video") {
      const item: SaleDayMedia = {
        mediaType: "video",
        src: resolveDayMediaSrc(ref.key),
      };
      if (ref.caption) item.caption = ref.caption;
      if (ref.posterKey) item.posterSrc = resolveDayMediaSrc(ref.posterKey);
      return item;
    }
    const item: SaleDayMedia = {
      mediaType: "image",
      src: resolveDayMediaSrc(ref.key),
    };
    if (ref.caption) item.caption = ref.caption;
    if (ref.alt) item.alt = ref.alt;
    return item;
  });
}

export function mapSaleToDayGalleryVM(sale: Sale): DayGalleryVM | null {
  if (sale.status !== "ended" || !isSaleroomDeliveryMode(sale.deliveryMode)) {
    return null;
  }
  const rawItems = buildDayGalleryItems(sale).filter((item) => item.src.trim().length > 0);
  if (rawItems.length === 0) return null;

  let photoN = 0;
  const items: SaleDayMedia[] = rawItems.map((item) => {
    if (item.mediaType === "video") return item;
    photoN += 1;
    return {
      ...item,
      alt: item.alt?.trim() ? item.alt.trim() : `${sale.title} — auction day photo ${photoN}`,
    };
  });
  return { saleTitle: sale.title, items };
}
