import type { StreamPresentation } from "@/lib/sale-stream-policy";
import type { LotCardTimingVM, Sale, SaleDayMedia } from "@auction/types";

/** View-models for the saleroom page (ISP).
 * These types are intentionally small and opinionated toward rendering; mappers in
 * `mappers.ts` are the only place raw `Sale` / `Lot` types are read (DIP).
 */

export type SaleHeroVM = {
  id: string;
  title: string;
  coverImage: string | null;
  startEndLabel: string;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
  /** ISO 8601 start of bidding — drives the hero "Opens in" countdown. */
  startTime: string | null;
  /** ISO 8601 end of bidding — drives the hero "Closes in" countdown. */
  endTime: string | null;
  isLive: boolean;
  shareUrl: string;
  itemsLabel: string;
  /** Uppercased one-line: date range | time | location (or empty tail if unknown). */
  dateLine: string;
  /** Relative time until preview opens when `previewStartTime` is set (Figma: left detail cell).
   */
  registrationClosesShort: string | null;
  /** Relative time until bidding opens — scheduled sales only (live state is in the meta row). */
  biddingStartsShort: string | null;
  /** Shown in the left bordered cell when `registrationClosesShort` is the preview value. */
  leftColumnLabel: "Preview opens" | null;
  /** Sidebar label for `biddingStartsShort` — scheduled sales only. */
  rightColumnLabel: "Bidding starts" | null;
  /** Optional precomputed count of lots that are currently live within this
   * sale. When present and the sale is live, the hero kicker reads
   * "· {liveLotsCount} lots live"; when omitted, the existing
   * "· {itemsLabel}" copy is preserved.
   */
  liveLotsCount?: number;
  /** Optional aggregated estimate total for the sale (e.g. "£8.4M"). When
   * present the third hero stat becomes "Est. Total"; absent leaves the
   * existing "Format" stat in place.
   */
  estimatedTotalLabel?: string;
  /** Masked registered bidder count when API provides it. */
  registeredBidderCount?: number;
  deliveryMode: Sale["deliveryMode"];
};

export type SaleLotCardVM = {
  id: string;
  href: string;
  lotNumber?: number | null;
  lotLabel: string | null;
  title: string;
  imageUrl: string | null;
  imageAlt: string;
  /** Raw estimate value line (e.g. "$1,200,000") for the Estimate column. */
  estimateValue: string | null;
  currentBidLabel: string;
  currentBidValue: string;
  /** Public lot payloads omit bid count; keep null until the API adds it. */
  bidsCountLabel: string | null;
  closingLabel: string | null;
  /** Short relative phrase e.g. "2 days" / "Soon".
   * For scheduled lots this is relative to `startTime` (opens-in);
   * for active lots it is relative to `endTime` (closes-in).
   */
  closingShort: string | null;
  isLive: boolean;
  viewerOwnsLot: boolean;
  /** Secondary line under title: artist if known, else medium, else null. */
  artistOrMedium: string | null;
  /** Initial watch state for the Follow control. */
  viewerIsWatching: boolean;
  /** When saleroom session is live and this lot is on the block. */
  isOnBlock?: boolean;
  /** Drives Sold vs Unsold when status is `ended`. */
  winnerId?: string | null | undefined;
  hasWinner?: boolean;
} & LotCardTimingVM;

export type RelatedSaleVM = {
  id: string;
  href: string;
  title: string;
  kindLabel: string;
  dateLabel: string;
  itemsLabel: string;
  imageUrl: string | null;
  coverImageAlt: string;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
  deliveryMode: import("@auction/types").SaleDeliveryMode;
  isLive: boolean;
  startsSoon: boolean;
  countdownEndIso: string | null;
  locationLabel: string | null;
  /** Uppercased date line for related row header (alias of dateLabel for Figma). */
  dateLine: string;
};

export type EndedSaleSummaryVM = {
  soldCount: number;
  unsoldCount: number;
  hammerTotalLabel: string;
  /** Set when catalogue was not fully loaded for aggregation. */
  partialLabel?: string;
};

/** Overview tab: all salient sale fields for the read-only marketing panel. */
export type SaleOverviewVM = {
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
  description: string | null;
  startLabel: string;
  endLabel: string;
  previewLabel: string | null;
  formatLabel: string;
  buyerPremiumLabel: string;
  buyerPremiumTiers: import("@auction/types").BuyerPremiumTier[] | null;
  categoryLabel: string | null;
  categoryLabels: string[];
  tags: string[];
  streamUrl: string | null;
  /** Whether the sale page should render the stream (includes recording for ended sales). */
  showSalePageStream: boolean;
  /** Full copy/label bundle; null when showSalePageStream is false. */
  streamPresentation: StreamPresentation | null;
  saleTitle: string;
  streamPosterUrl: string | null;
  terms: string | null;
  /** Onsite event location (venue name, address, optional map link). */
  locationName: string | null;
  locationAddress: string | null;
  locationMapUrl: string | null;
  /** Lines of the formatted postal address (preferring structured fields). */
  locationAddressLines: string[];
  /** Resolved Google Maps URL (custom override, else generated from address). */
  resolvedMapUrl: string | null;
  /** Google Maps embed URL for click-to-load preview (no API key). */
  locationEmbedUrl: string | null;
  showLocation: boolean;
  /** Aggregated ended-sale stats when sale has ended and lots are loaded. */
  endedSaleSummary?: EndedSaleSummaryVM | null;
};

/** View-model for the auction-day media gallery section (ended onsite/hybrid only). */
export type DayGalleryVM = {
  saleTitle: string;
  /** Resolved media items — photos and/or video clips in presentation order. */
  items: SaleDayMedia[];
};

/** View-model for a single curated press/news item. */
export type PressCoverageVM = {
  url: string;
  headline: string;
  outletName: string;
  /** Hostname extracted from the URL, e.g. "dailymail.co.uk". */
  domain: string;
  /** Human-readable date string, e.g. "14 Jun 2026". Null when publishedAt absent. */
  dateLabel: string | null;
  /** ISO date (YYYY-MM-DD) for `<time dateTime>`. */
  publishedAt: string | null;
  excerpt: string | null;
  mentionType: import("@auction/types").SalePressMentionType | null;
  /** Article preview image when resolved from the source URL. */
  imageUrl: string | null;
};
