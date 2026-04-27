/**
 * View-models for the saleroom page (ISP).
 * These types are intentionally small and opinionated toward rendering; mappers in
 * `mappers.ts` are the only place raw `Sale` / `Lot` types are read (DIP).
 */

export type SaleHeroStatusBadge =
  | { kind: "live"; label: string }
  | { kind: "upcoming"; label: string }
  | { kind: "ended"; label: string }
  | null;

export type SaleHeroVM = {
  id: string;
  title: string;
  coverImage: string | null;
  startEndLabel: string;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
  isLive: boolean;
  registrationClosesLabel: string | null;
  biddingStartsLabel: string | null;
  description: string | null;
  shareUrl: string;
  itemsLabel: string;
  tags: string[];
  /** Uppercased one-line: date range | time | location (or empty tail if unknown). */
  dateLine: string;
  /**
   * Relative time until preview opens when `previewStartTime` is set (Figma: left detail cell).
   */
  registrationClosesShort: string | null;
  /**
   * Bidding state: relative to `startTime` when scheduled, "Live now" when active, else null.
   */
  biddingStartsShort: string | null;
  /** Shown in the left bordered cell when `registrationClosesShort` is the preview value. */
  leftColumnLabel: "Preview opens" | null;
  rightColumnLabel: "Bidding" | "Bidding starts" | null;
  /** Subtle one-line: format, buyer’s premium, optional category. */
  overviewMetaLine: string | null;
  /** Shown next to the live dot in the date row. */
  liveLabel: string;
  /** Hero headline pill: live / upcoming / ended (Figma), or null for draft/cancelled. */
  statusBadge: SaleHeroStatusBadge;
};

export type SaleLotCardVM = {
  id: string;
  href: string;
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
  /** Short relative e.g. "2 days" for the Closing row. */
  closingShort: string | null;
  isLive: boolean;
  viewerOwnsLot: boolean;
  /** Secondary line under title: artist if known, else medium, else null. */
  artistOrMedium: string | null;
  /** Initial watch state for the Follow control. */
  viewerIsWatching: boolean;
};

export type RelatedSaleVM = {
  id: string;
  href: string;
  title: string;
  kindLabel: string;
  dateLabel: string;
  itemsLabel: string;
  imageUrl: string | null;
  /** Uppercased date line for related row header (alias of dateLabel for Figma). */
  dateLine: string;
};

/** Overview tab: all salient sale fields for the read-only marketing panel. */
export type SaleOverviewVM = {
  description: string | null;
  startLabel: string;
  endLabel: string;
  previewLabel: string | null;
  formatLabel: string;
  buyerPremiumLabel: string;
  categoryLabel: string | null;
  lotsLabel: string;
  tags: string[];
  streamUrl: string | null;
  showLiveStream: boolean;
  terms: string | null;
  /** Onsite event location (venue name, address, optional map link). */
  locationName: string | null;
  locationAddress: string | null;
  locationMapUrl: string | null;
  /** Lines of the formatted postal address (preferring structured fields). */
  locationAddressLines: string[];
  /** Resolved Google Maps URL (custom override, else generated from address). */
  resolvedMapUrl: string | null;
  showLocation: boolean;
};
