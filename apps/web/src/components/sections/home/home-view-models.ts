import type { SaleListRow } from "@/lib/data/http/sales.server";
import { formatLotAuctionLine, formatSaleDateRange } from "@/lib/format-auction-date";
import { formatMoney } from "@/lib/format-currency";
import { featuredLotHeading, lotLabelFromLot } from "@/lib/lot-label";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import { saleMarketingLocationLabel } from "@/lib/sale-location-label";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import { lotPath, salePath } from "@/lib/seo/url";
import type { Lot, LotStatus, Sale } from "@auction/types";
import type { StreamEmbedProvider } from "@auction/validators";
import {
  HERO_PLACEHOLDER_ARTIST,
  HERO_PLACEHOLDER_FEATURED_HEADING,
  HERO_PLACEHOLDER_SALE_LINE,
  HERO_PLACEHOLDER_TITLE,
} from "./home-defaults";

export type HeroLotVM = {
  id: string;
  href?: string;
  title: string;
  artistName: string;
  priceLabel: string;
  priceFormatted: string;
  currentBidFormatted: string;
  bidCountDisplay: string;
  heroImageUrl: string | null;
  /** Descriptive alt for the hero artwork image */
  imageAlt: string;
  auctionDateLabel: string;
  /** Second segment after live dot, e.g. sale title */
  saleMetaLine: string;
  featuredHeading: string;
  lotLabel: string;
  /** True when lot status is active (for live region announcements). */
  isAuctionLive: boolean;
  /** When present and the lot is live, the secondary hero CTA links to the
   * saleroom. Falls back to the lot artwork URL otherwise.
   */
  saleroomHref?: string;
  /** ISO 8601 — when the lot opens. Used for hero countdown when not yet live. */
  startTime?: string;
  /** ISO 8601 — when the lot closes. Used for hero countdown when live. */
  endTime?: string;
};

export type HeroSaleSlideVM = {
  id: string;
  href: string;
  title: string;
  dateLabel: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  modeBadge: string;
  deliveryMode?: Sale["deliveryMode"];
};

export type HeroStateVM =
  | {
      kind: "live";
      saleId: string;
      saleTitle: string;
      embedSrc: string;
      provider: StreamEmbedProvider;
      modeLabel: string;
      saleroomHref: string;
      /** Present when provider is youtube — used for background embed + watch link */
      videoId?: string | undefined;
      startSeconds?: number | undefined;
      /** Sale cover for reduced-motion / visual fallback */
      posterImageUrl?: string | null | undefined;
    }
  | { kind: "rotator"; slides: HeroSaleSlideVM[] }
  | { kind: "fallbackLot"; lot: HeroLotVM };

export type LotPriceEmphasis = "estimate" | "currentBid" | "both";

/** Pre-formatted estimate range. Optional today — populated only when the
 * Lot schema gains `estimateLow` / `estimateHigh` columns (tracked in the
 * design handoff doc). Consumers fall back to `priceFormatted` when absent.
 */
export type LotEstimateRange = {
  low: string;
  high: string;
  /** Combined display, e.g. `£300,000 – £400,000`. */
  display: string;
};

/** Figma ending-soon card: stacked estimate + current / starting row. */
export type EndingSoonPriceRowsVM = {
  estimate: { label: string; value: string };
  current: { label: string; value: string };
};

export type LotCardVM = {
  id: string;
  href: string;
  lotLabel: string;
  title: string;
  artistName: string;
  priceLabel: string;
  priceFormatted: string;
  imageUrl: string | null;
  /** Alt text when `imageUrl` is set */
  imageAlt: string;
  sellerId: string;
  status: LotStatus;
  /** ISO 8601 — used by client lot timer */
  startTime: string;
  /** ISO 8601 — used by client lot timer */
  endTime: string;
  /** Visual emphasis hint for marketing cards. The card always renders
   * `priceLabel` + `priceFormatted`; emphasis tells it which line to make
   * dominant. Defaults to `estimate` when omitted (current behaviour).
   */
  priceEmphasis?: LotPriceEmphasis;
  /** Optional estimate range. Populated when the lot has both low and high
   * estimate columns (future schema). Display layer prefers this over
   * `priceFormatted` when present. */
  estimateRange?: LotEstimateRange;
  /** Home ending-soon section: dual price stack + layout skips generic card chrome. */
  endingSoonPriceRows?: EndingSoonPriceRowsVM;
};

/** Home marketing grid: horizontal auction tile (Figma “Upcoming Auctions”). */
export type HomeUpcomingAuctionTileVM = {
  id: string;
  href: string;
  title: string;
  dateLabel: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  lotCount: number;
  /** e.g. “Online auction” / “Onsite auction” — first segment of the meta line. */
  auctionKindLabel: string;
  deliveryMode: Sale["deliveryMode"];
  status: Sale["status"];
  /** Sale is live (lots may be bidding). */
  isLive?: boolean;
  /** Sale starts within the next 7 days and is not yet active. */
  startsSoon?: boolean;
  /** Live sale end time for `SaleCardMedia` countdown (active sales only). */
  countdownEndIso?: string;
  locationLabel: string | null;
};

/** Figma “Editor’s Picks” horizontal lot card (image + estimate + CTA). */
export type EditorsPickLotCardVM = {
  id: string;
  href: string;
  title: string;
  artistName: string;
  imageUrl: string | null;
  imageAlt: string;
  estimateLabel: string;
  estimateValue: string;
};

/** B5 — Single private-sale showcase item. Price displayed as `On request`. */
export type PrivateSaleHighlightVM = {
  id: string;
  href: string;
  title: string;
  artistName: string;
  imageUrl: string | null;
  imageAlt: string;
  /** Optional medium / period label, e.g. "Oil on canvas, 1932". */
  caption?: string;
};

function artistLineFromLot(lot: Lot): string {
  return lot.medium?.trim() || lot.description?.trim()?.slice(0, 80) || "Contemporary";
}

function heroImageAlt(title: string, artistName: string): string {
  return `${title} — artwork by ${artistName}`;
}

export function toHeroSaleSlideVM(sale: Sale): HeroSaleSlideVM {
  const pres = getSaleTypePresentation(sale.deliveryMode);
  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    dateLabel: formatSaleDateRange(sale),
    coverImageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: `${sale.title} — auction cover`,
    modeBadge: pres.label,
    deliveryMode: sale.deliveryMode,
  };
}

export function createHeroFallbackVm(): HeroLotVM {
  return {
    id: "placeholder",
    title: HERO_PLACEHOLDER_TITLE,
    artistName: HERO_PLACEHOLDER_ARTIST,
    priceLabel: "Catalogue",
    priceFormatted: "—",
    currentBidFormatted: "—",
    bidCountDisplay: "—",
    heroImageUrl: null,
    imageAlt: "Hero artwork",
    auctionDateLabel: HERO_PLACEHOLDER_SALE_LINE,
    saleMetaLine: HERO_PLACEHOLDER_SALE_LINE,
    featuredHeading: HERO_PLACEHOLDER_FEATURED_HEADING,
    lotLabel: "Lot",
    isAuctionLive: false,
  };
}

export function toHeroLotVM(
  lot: Lot,
  saleTitle: string | null,
  options?: { saleId?: string | null },
): HeroLotVM {
  const saleMetaLine = saleTitle?.trim() || formatLotAuctionLine(lot);
  const artistName = artistLineFromLot(lot);
  const primary = lotPriceDisplay(lot);
  const saleId = options?.saleId?.trim();
  const startTime =
    lot.startTime instanceof Date ? lot.startTime.toISOString() : String(lot.startTime);
  const endTime = lot.endTime instanceof Date ? lot.endTime.toISOString() : String(lot.endTime);
  return {
    id: lot.id,
    href: lotPath(lot),
    title: lot.title,
    artistName,
    priceLabel: primary.label,
    priceFormatted: primary.value,
    currentBidFormatted: formatMoney(lot.currentPrice),
    bidCountDisplay: "—",
    heroImageUrl: lot.images[0] ?? null,
    imageAlt: heroImageAlt(lot.title, artistName),
    auctionDateLabel: formatLotAuctionLine(lot),
    saleMetaLine,
    featuredHeading: featuredLotHeading(lot),
    lotLabel: lotLabelFromLot(lot),
    isAuctionLive: lot.status === "active",
    ...(saleId ? { saleroomHref: salePath({ id: saleId, title: saleTitle ?? "sale" }) } : {}),
    startTime,
    endTime,
  };
}

function priceEmphasisFromStatus(lot: Lot): LotPriceEmphasis {
  if (lot.status === "active") return "currentBid";
  if (lot.status === "ended") return "both";
  return "estimate";
}

export function toLotCardVM(lot: Lot): LotCardVM {
  const artistName = artistLineFromLot(lot);
  const { label, value } = lotPriceDisplay(lot);
  const startTime =
    lot.startTime instanceof Date ? lot.startTime.toISOString() : String(lot.startTime);
  const endTime = lot.endTime instanceof Date ? lot.endTime.toISOString() : String(lot.endTime);
  return {
    id: lot.id,
    href: lotPath(lot),
    lotLabel: lotLabelFromLot(lot),
    title: lot.title,
    artistName,
    priceLabel: label,
    priceFormatted: value,
    imageUrl: lot.images[0] ?? null,
    imageAlt: `${lot.title} — artwork by ${artistName}`,
    sellerId: lot.sellerId ?? lot.sellerLegalEntityId ?? "",
    status: lot.status,
    startTime,
    endTime,
    priceEmphasis: priceEmphasisFromStatus(lot),
  };
}

export function toLotCardVMs(lots: Lot[]): LotCardVM[] {
  return lots.map(toLotCardVM);
}

/** Figma B3 card: estimate row + `lotPriceDisplay` row (e.g. current bid). */
function estimateDisplayFromLot(lot: Lot, base: LotCardVM): string {
  if (base.estimateRange?.display) return base.estimateRange.display;
  const est = lot.marketingDetails?.estimate;
  if (est?.low != null && est?.high != null && est.low !== "" && est.high !== "") {
    return `${formatMoney(est.low)} – ${formatMoney(est.high)}`;
  }
  return formatMoney(lot.startingPrice);
}

export function toEndingSoonLotCardVM(lot: Lot): LotCardVM {
  const base = toLotCardVM(lot);
  const estimateValue = estimateDisplayFromLot(lot, base);
  const current = lotPriceDisplay(lot);
  return {
    ...base,
    endingSoonPriceRows: {
      estimate: { label: "Estimate", value: estimateValue },
      current: { label: current.label, value: current.value },
    },
  };
}

export function toEndingSoonLotCardVMs(lots: Lot[]): LotCardVM[] {
  return lots.map(toEndingSoonLotCardVM);
}

export function toHomeUpcomingAuctionTileVM(row: SaleListRow): HomeUpcomingAuctionTileVM {
  const { sale, lots } = row;
  const auctionKindLabel = getSaleTypePresentation(sale.deliveryMode).title;
  const now = Date.now();
  const startMs =
    sale.startTime instanceof Date ? sale.startTime.getTime() : Date.parse(String(sale.startTime));
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const isLive = sale.status === "active";
  const startsSoon =
    !isLive && Number.isFinite(startMs) && startMs > now && startMs <= now + sevenDaysMs;
  const countdownEndIso =
    sale.status === "active" ? new Date(sale.endTime).toISOString() : undefined;
  const locationLabel = saleMarketingLocationLabel(sale);
  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    dateLabel: formatSaleDateRange(sale),
    coverImageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: `${sale.title} — auction cover`,
    lotCount: lots.length,
    auctionKindLabel,
    deliveryMode: sale.deliveryMode,
    status: sale.status,
    locationLabel,
    ...(isLive ? { isLive: true } : {}),
    ...(startsSoon ? { startsSoon: true } : {}),
    ...(countdownEndIso !== undefined ? { countdownEndIso } : {}),
  };
}

export function toHomeUpcomingAuctionTileVMs(rows: SaleListRow[]): HomeUpcomingAuctionTileVM[] {
  return rows.map(toHomeUpcomingAuctionTileVM);
}

export function toEditorsPickLotCardVM(lot: Lot): EditorsPickLotCardVM {
  const base = toLotCardVM(lot);
  return {
    id: base.id,
    href: base.href,
    title: base.title,
    artistName: base.artistName,
    imageUrl: base.imageUrl,
    imageAlt: base.imageAlt,
    estimateLabel: "Estimate",
    estimateValue: estimateDisplayFromLot(lot, base),
  };
}

export function toEditorsPickLotCardVMs(lots: Lot[]): EditorsPickLotCardVM[] {
  return lots.map(toEditorsPickLotCardVM);
}

export function toPrivateSaleHighlightVM(lot: Lot): PrivateSaleHighlightVM {
  const base = toLotCardVM(lot);
  const caption =
    lot.medium?.trim() ||
    (lot.description?.trim() ? lot.description.trim().slice(0, 96) : undefined);
  return {
    id: base.id,
    href: base.href,
    title: base.title,
    artistName: base.artistName,
    imageUrl: base.imageUrl,
    imageAlt: base.imageAlt,
    ...(caption ? { caption } : {}),
  };
}

export function toPrivateSaleHighlightVMs(lots: Lot[]): PrivateSaleHighlightVM[] {
  return lots.map(toPrivateSaleHighlightVM);
}
