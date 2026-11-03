import { lotLabelFromLot } from "@/lib/lot-label";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import { lotPath } from "@/lib/seo/url";
import type { Lot, LotCardTimingVM } from "@auction/types";
import { toLotCardTimingVM } from "@auction/validators";

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
