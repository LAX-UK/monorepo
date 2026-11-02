import { formatSaleDateRange } from "@/lib/format-auction-date";
import { lotLabelFromLot } from "@/lib/lot-label";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import type { SaleListRow } from "@/lib/sale-list-row";
import { saleMarketingLocationLabel } from "@/lib/sale-location-label";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import { lotPath, salePath } from "@/lib/seo/url";
import type { Lot, LotCardTimingVM, Sale } from "@auction/types";
import { toLotCardTimingVM, toOptionalIsoString, toSaleCountdownEndIso } from "@auction/validators";

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
  /** Drives Sold vs Unsold on status badges when lot has ended. */
  winnerId?: string | null;
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
} & LotCardTimingVM;

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
  endTimeIso?: string;
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

function artistLineFromLot(lot: Lot): string {
  return lot.medium?.trim() || lot.description?.trim()?.slice(0, 80) || "Contemporary";
}

function priceEmphasisFromStatus(lot: Lot): LotPriceEmphasis {
  if (lot.status === "active") return "currentBid";
  if (lot.status === "ended") return "both";
  return "estimate";
}

export function toLotCardVM(lot: Lot): LotCardVM {
  const artistName = artistLineFromLot(lot);
  const { label, value } = lotPriceDisplay(lot);
  const timing = toLotCardTimingVM(lot);
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
    winnerId: lot.winnerId,
    ...timing,
    priceEmphasis: priceEmphasisFromStatus(lot),
  };
}

export function toLotCardVMs(lots: Lot[]): LotCardVM[] {
  return lots.map(toLotCardVM);
}

/** Figma B3 card: estimate row + `lotPriceDisplay` row (e.g. current bid). */
function estimateDisplayFromLot(lot: Lot, base: LotCardVM): string {
  if (base.estimateRange?.display) return base.estimateRange.display;
  const fromMarketing = lotEstimateLine(lot);
  if (fromMarketing) return fromMarketing;
  const { value } = lotPriceDisplay(lot);
  return value && value !== "undefined" ? value : "—";
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
  const { sale, lotCount } = row;
  const auctionKindLabel = getSaleTypePresentation(sale.deliveryMode).title;
  const now = Date.now();
  const startMs =
    sale.startTime instanceof Date ? sale.startTime.getTime() : Date.parse(String(sale.startTime));
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const isLive = sale.status === "active";
  const startsSoon =
    !isLive && Number.isFinite(startMs) && startMs > now && startMs <= now + sevenDaysMs;
  const countdownEndIso = toSaleCountdownEndIso(sale);
  const endTimeIso = toOptionalIsoString(sale.endTime);
  const locationLabel = saleMarketingLocationLabel(sale);
  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    dateLabel: formatSaleDateRange(sale),
    coverImageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: `${sale.title} — auction cover`,
    lotCount,
    auctionKindLabel,
    deliveryMode: sale.deliveryMode,
    status: sale.status,
    locationLabel,
    ...(isLive ? { isLive: true } : {}),
    ...(startsSoon ? { startsSoon: true } : {}),
    ...(endTimeIso !== undefined ? { endTimeIso } : {}),
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
