import type { AuctionTimingValue } from "./auction-timing.js";
import type { BuyerPremiumTier } from "./buyer-premium.js";
import type { GalleryImage } from "./gallery.js";

export const saleStatuses = ["draft", "scheduled", "active", "ended", "cancelled"] as const;
export type SaleStatus = (typeof saleStatuses)[number];

/** Media type discriminator for auction-day items. Absent → treated as "image" for backwards compat. */
export type SaleDayMediaType = "image" | "video";

/**
 * Storage form for a single auction-day image.
 * `mediaType` is optional and defaults to "image" when absent for backwards compatibility.
 */
export type SaleDayPhotoRef = {
  mediaType?: "image";
  key: string;
  caption?: string;
  alt?: string;
};

/**
 * Storage form for a single auction-day video clip.
 * `posterKey` is an optional storage key for a thumbnail/poster image.
 */
export type SaleDayVideoRef = {
  mediaType: "video";
  key: string;
  caption?: string;
  posterKey?: string;
};

/** Storage form for either an auction-day photo or video. */
export type SaleDayMediaRef = SaleDayPhotoRef | SaleDayVideoRef;

// ─── Press coverage ──────────────────────────────────────────────────────────

export type SalePressMentionType = "feature" | "interview" | "quote" | "roundup";

/**
 * Storage form for a single press coverage item (curated external link).
 * `imageUrl` is populated server-side from the article's Open Graph preview when available.
 */
export type SalePressRef = {
  url: string;
  headline: string;
  outletName: string;
  /** ISO date string YYYY-MM-DD. */
  publishedAt?: string;
  /** Short pull-quote or excerpt (max 280 chars). */
  excerpt?: string;
  mentionType?: SalePressMentionType;
  /** Resolved preview image URL (typically og:image). */
  imageUrl?: string;
};

/** Resolved/public form — structurally identical to SalePressRef (no enrichment). */
export type SalePressItem = SalePressRef;

/** Resolved/public form: enriched GalleryImage merged with caption and media type. */
export type SaleDayPhoto = GalleryImage & {
  mediaType: "image";
  caption?: string;
};

/** Resolved/public form for an auction-day video clip. */
export type SaleDayVideo = {
  mediaType: "video";
  src: string;
  posterSrc?: string;
  caption?: string;
  width?: number;
  height?: number;
};

/** Resolved/public form: photo or video. */
export type SaleDayMedia = SaleDayPhoto | SaleDayVideo;

export const saleDeliveryModes = ["online", "onsite", "hybrid"] as const;
export type SaleDeliveryMode = (typeof saleDeliveryModes)[number];

export type Sale = {
  id: string;
  title: string;
  description: string | null;
  coverImages: string[];
  /** Enriched metadata (width/height/blur) aligned with `coverImages` when available. */
  coverImageAssets?: GalleryImage[];
  /** Auction-day event photos and videos (raw refs). Only set for onsite/hybrid. */
  dayImages?: SaleDayMediaRef[];
  /** Enriched/resolved auction-day media. Populated by the API after media enrichment. */
  dayImageAssets?: SaleDayMedia[];
  /** Curated external press/news links. Visible publicly as soon as any items are added. */
  pressCoverage?: SalePressRef[];
  categoryIds?: string[];
  /** @deprecated Use categoryIds[0] while legacy web surfaces are migrated. */
  categoryId: string | null;
  deliveryMode: SaleDeliveryMode;
  /**
   * Hybrid only: when true, online web bids are allowed before clerk Go Live.
   * Default false = gated behind saleroom session + on-block lot.
   */
  allowOnlineBidsBeforeGoLive: boolean;
  streamUrl: string | null;
  /** Onsite venue name (free-form). */
  locationName: string | null;
  /** Free-form single-line/multi-line address used for fallback display and
   * older records. Newer onsite sales prefer the structured address fields
   * below; UI should fall back to this string when those are missing.
   */
  locationAddress: string | null;
  /** Optional explicit map URL (Google Maps, etc.) for onsite events. */
  locationMapUrl: string | null;
  /** Structured UK-friendly address line 1 (street + number). */
  locationAddressLine1: string | null;
  /** Structured UK-friendly address line 2 (apartment, building, etc.). */
  locationAddressLine2: string | null;
  /** City / town / post town. */
  locationCity: string | null;
  /** County (UK) or region/state. */
  locationCounty: string | null;
  /** Normalized postcode (UK postcodes are stored uppercased and spaced). */
  locationPostcode: string | null;
  /** ISO country name (defaults to "United Kingdom" in admin UX). */
  locationCountry: string | null;
  /** Reusable venue reference for onsite sales; location fields remain the publish snapshot. */
  venueId?: string | null;
  status: SaleStatus;
  startTime: Date;
  endTime: Date;
  previewStartTime: Date | null;
  buyerPremiumRate: string;
  /**
   * Optional band-based premium tier override (sale-level). When present and non-empty
   * the pricing factory uses these tiers in preference to each lot's `buyerPremiumRate`.
   * See `docs/runbooks/buyer-premium-tiers.md`.
   */
  buyerPremiumTiers: BuyerPremiumTier[] | null;
  terms: string | null;
  /** Transitional compatibility only; new API mappers do not emit this field. */
  createdBy?: string;
  createdByLegalEntityId?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  deletedByUserId?: string | null;
};

/** Sale timing as received over the wire or after RSC serialization. */
export type SaleTimingValue = AuctionTimingValue;

/** Raw sale fields consumed by timing normalizers. */
export type SaleTimingSource = {
  status: SaleStatus;
  startTime: SaleTimingValue;
  endTime: SaleTimingValue;
};

/** Normalized ISO timing for sale cards, heroes, and countdowns. */
export type SaleCardTimingVM = {
  status: SaleStatus;
  startTime: string | null;
  endTime: string | null;
};

/** Wire/RSC sale payload — date fields may be ISO strings or null. */
export type SerializedSale = Omit<
  Sale,
  "startTime" | "endTime" | "previewStartTime" | "createdAt" | "updatedAt"
> & {
  startTime: SaleTimingValue;
  endTime: SaleTimingValue;
  previewStartTime: SaleTimingValue;
  createdAt: SaleTimingValue;
  updatedAt: SaleTimingValue;
};

export type CreateSaleInput = {
  title: string;
  description?: string | undefined;
  coverImages?: string[] | undefined;
  /** Optional theme categories (marketing + defaults for nested lots in admin). */
  categoryIds?: string[] | undefined;
  /** @deprecated Prefer categoryIds. Accepted during the migration window. */
  categoryId?: string | undefined;
  deliveryMode?: SaleDeliveryMode | undefined;
  allowOnlineBidsBeforeGoLive?: boolean | undefined;
  streamUrl?: string | null | undefined;
  locationName?: string | null | undefined;
  locationAddress?: string | null | undefined;
  locationMapUrl?: string | null | undefined;
  locationAddressLine1?: string | null | undefined;
  locationAddressLine2?: string | null | undefined;
  locationCity?: string | null | undefined;
  locationCounty?: string | null | undefined;
  locationPostcode?: string | null | undefined;
  locationCountry?: string | null | undefined;
  venueId?: string | null | undefined;
  startTime: Date;
  endTime: Date;
  previewStartTime?: Date | undefined;
  buyerPremiumRate?: string | undefined;
  buyerPremiumTiers?: BuyerPremiumTier[] | null | undefined;
  terms?: string | undefined;
  createdByLegalEntityId?: string | undefined;
  /** Auction-day event photos/videos to persist (only accepted for ended onsite/hybrid sales). */
  dayImages?: SaleDayMediaRef[] | undefined;
  /** Curated press/news links (accepted for all sale statuses and delivery modes). */
  pressCoverage?: SalePressRef[] | undefined;
};
