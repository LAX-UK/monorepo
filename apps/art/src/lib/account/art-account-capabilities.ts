import type { PortalSellerAccess } from "@auction/shop-contracts";
import type { ShopPortalFetchResult } from "@auction/shop-portal/portal";

/** "yes" or "no" from the person's own records; "unknown" when the lookup failed. */
export type ArtCapabilityProbe = "yes" | "no" | "unknown";

/**
 * What a signed-in person can do on lax.art beyond collecting. Every collector has Enquiries,
 * Favourites and Following; anything else is listed here and shown only on a definite "yes", so
 * a plain buyer never sees seller tools and an outage never invents them.
 */
export type ArtAccountCapabilities = {
  /** Is paid by LAX for sales (a seller, or someone with sales or payouts on record). */
  receivesPayouts: ArtCapabilityProbe;
};

export type ArtAccountCapability = keyof ArtAccountCapabilities;

export const NO_ART_ACCOUNT_CAPABILITIES: ArtAccountCapabilities = { receivesPayouts: "no" };

/** Shop decides seller roles from the person's records; switched off means none. */
export function artAccountCapabilitiesFrom(
  sellerAccess: ShopPortalFetchResult<PortalSellerAccess>,
): ArtAccountCapabilities {
  switch (sellerAccess.status) {
    case "ok":
      return { receivesPayouts: sellerAccess.data.payouts ? "yes" : "no" };
    case "empty":
    case "commerce_unavailable":
      return NO_ART_ACCOUNT_CAPABILITIES;
    case "unauthorized":
    case "failed":
      return { receivesPayouts: "unknown" };
  }
}

export function holdsCapability(
  capabilities: ArtAccountCapabilities,
  capability: ArtAccountCapability,
): boolean {
  return capabilities[capability] === "yes";
}
