/** Matches DB enum `auction_type` on `lot`. */
export const lotAuctionTypes = ["english", "dutch", "sealed", "buy_it_now"] as const;
export type LotAuctionType = (typeof lotAuctionTypes)[number];

export const lotStatuses = [
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
  "voided",
] as const;
export type LotStatus = (typeof lotStatuses)[number];

/** Card/list projection of a lot — omits heavy catalogue fields. */
export type LotSummary = {
  id: string;
  saleId: string | null;
  lotNumber: number | null;
  title: string;
  status: LotStatus;
  currentPrice: string;
  endTime: Date;
  images: string[];
  categoryIds?: string[];
};

/** Optional marketing / catalog enrichment (stored as JSON on `lot`). */
export type LotMarketingDetails = {
  estimate?: { low: string; high: string; currency: string };
  conditionReport?: {
    summary?: string;
    details?: string;
    downloadUrl?: string;
  };
  provenance?: { period?: string; note: string }[];
  /** Parallel alts for `images[index]` when provided */
  imageAlts?: (string | undefined)[];
  /** Optional exhibition history (authoring via marketing JSON; no column migration). */
  exhibitions?: { year?: string; venue: string; note?: string }[];
  /** Optional per-lot artist blurb; falls back to public profile when added later. */
  artistNote?: string;
};

export type Lot = {
  id: string;
  saleId: string | null;
  lotNumber: number | null;
  /** Transitional compatibility only; new API mappers do not emit this field. */
  sellerId?: string;
  sellerLegalEntityId?: string | undefined;
  /** artist registry FK */
  artistId?: string | null;
  /** gates publish when artist is pending */
  artistReviewRequired?: boolean;
  title: string;
  description: string | null;
  /** Physical / catalog medium (e.g. oil on canvas). */
  medium: string | null;
  /** Display dimensions (e.g. 180 x 140 cm). */
  dimensions: string | null;
  images: string[];
  categoryIds?: string[];
  /** @deprecated Use categoryIds[0] while legacy web surfaces are migrated. */
  categoryId: string;
  auctionType: LotAuctionType;
  startingPrice: string;
  reservePrice: string | null;
  buyNowPrice: string | null;
  currentPrice: string;
  /** Decimal fraction, e.g. "0.25" for 25% buyer's premium on hammer. */
  buyerPremiumRate: string;
  /**
   * When present, server-computed hammer / premium / total in **major currency** (e.g. GBP)
   * using `buildBuyerPremiumPolicy` (sale-level tiers override per-lot rate). Used by dashboard
   * portfolio, checkout, and any client that must not duplicate premium math.
   */
  checkoutPricing?: {
    hammerMajor: string;
    premiumMajor: string;
    totalMajor: string;
    policyId: string;
    /** Discriminant — avoids string-parsing on consumers. */
    kind: "flat" | "tiered";
  };
  /** Minimum raise over current price (English / buy-it-now paths). */
  minBidIncrement: string;
  /** Staff toggle: buyers may set proxy auto-bid on this lot. */
  autoBidEnabled?: boolean;
  /** Floor for buyer-chosen auto-bid step (defaults to minBidIncrement). */
  autoBidStepMin?: string | null;
  /** Ceiling for buyer-chosen auto-bid step. */
  autoBidStepMax?: string | null;
  /** Allowed step values when staff restrict choices (e.g. [10, 25, 50]). */
  autoBidStepPresets?: number[] | null;
  /** Amount subtracted from current price each Dutch interval (optional; derived if null). */
  dutchDecrementAmount: string | null;
  dutchDecrementIntervalMs: number;
  dutchLastDecrementAt: Date | null;
  startTime: Date;
  endTime: Date;
  status: LotStatus;
  /** populated when status is voided. */
  voidedReason?: string | null;
  /** seller entity archived while lot was draft/scheduled. */
  archivedSeller?: boolean;
  winnerId: string | null;
  /** winner's acting legal entity at win time */
  buyerLegalEntityId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  marketingDetails: LotMarketingDetails;
  deletedAt?: Date | null;
  deletedByUserId?: string | null;
};

export type CreateLotInput = {
  title: string;
  description?: string | undefined;
  medium?: string | undefined;
  dimensions?: string | undefined;
  images?: string[] | undefined;
  sellerLegalEntityId?: string | undefined;
  /** Artist registry FK. Pass `null` to clear an existing attribution; pass a
   * uuid to attach. Admin-only via the route layer. */
  artistId?: string | null | undefined;
  categoryIds?: string[];
  /** @deprecated Prefer categoryIds. Accepted during the migration window. */
  categoryId?: string | undefined;
  auctionType: LotAuctionType;
  startingPrice: string;
  reservePrice?: string | undefined;
  buyNowPrice?: string | undefined;
  /** Optional; defaults per DB (e.g. 0.25). */
  buyerPremiumRate?: string | undefined;
  minBidIncrement?: string | undefined;
  autoBidEnabled?: boolean | undefined;
  autoBidStepMin?: string | undefined;
  autoBidStepMax?: string | undefined;
  autoBidStepPresets?: number[] | null | undefined;
  dutchDecrementAmount?: string | undefined;
  dutchDecrementIntervalMs?: number | undefined;
  startTime: Date;
  endTime: Date;
  saleId?: string | null | undefined;
  lotNumber?: number | null | undefined;
  marketingDetails?: LotMarketingDetails | undefined;
};
