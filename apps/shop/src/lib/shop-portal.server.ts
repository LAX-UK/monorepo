import { shopApiServerUrl } from "@/lib/shop-api.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { createPortalFetchers } from "@auction/shop-portal/portal";
import { cache } from "react";

const portalFetchers = createPortalFetchers({
  commerceRequest: shopCommerceRequest,
  shopApiServerUrl,
  readOwnershipEnvFlag: () => process.env.SHOP_PORTAL_OWNERSHIP_ENABLED?.trim(),
});

export type { PortalSaleAuthorityItem } from "@auction/shop-portal/portal";

/**
 * Seller tools only. Collection, editions, documents and enquiries moved to LAX Account and
 * lax.art, so their fetchers are not exposed here.
 */
export const { fetchPortalSaleAuthorityRequests, fetchPortalArtistSales, fetchPortalPayeeConnect } =
  portalFetchers;

/** Cached per request: the seller-role lookup and the page that shows the list share one call. */
export const fetchPortalSaleAuthority = cache(portalFetchers.fetchPortalSaleAuthority);
export const fetchPortalPayouts = cache(portalFetchers.fetchPortalPayouts);
export const fetchPortalSales = cache(portalFetchers.fetchPortalSales);
export const fetchPortalArtistArtworks = cache(portalFetchers.fetchPortalArtistArtworks);

/** Storefront hub links follow shop-api when the storefront env flag is unset. */
export const resolveShopPortalOwnershipEnabled = cache(
  portalFetchers.resolveShopPortalOwnershipEnabled,
);
