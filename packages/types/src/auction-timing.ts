/** Auction instant as received over the wire or after RSC serialization. */
export type AuctionTimingValue = string | Date | null | undefined;

/** Normalized ISO 8601 instant, or null when unknown. */
export type NormalizedIsoTime = string | null;

/** Optional ISO field for view models (omit when null). */
export type OptionalIsoTime = string | undefined;
