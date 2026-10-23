/** Which platform may take bids for this sale (computed; not stored). */
export type AtgSellingPlatform = "free" | "lax" | "atg";

export type AtgOwnershipState = AtgSellingPlatform | "cancelled";
