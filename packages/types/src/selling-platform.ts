/** Which platform may take bids for this sale (computed; not stored). */
export type AtgSellingPlatform = "free" | "lax" | "atg";

export type AtgOwnershipState = AtgSellingPlatform | "cancelled";

/** Where ATG lists an auction; only `public_marketplace` is shown on the public catalogue. */
export type AtgDistribution = "private_test" | "public_marketplace";
