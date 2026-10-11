import { shopApiServerUrl } from "@/lib/shop-api.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { createPortalFetchers } from "@auction/shop-portal/portal";
import { cache } from "react";

const portalFetchers = createPortalFetchers({
  commerceRequest: shopCommerceRequest,
  shopApiServerUrl,
  readOwnershipEnvFlag: () => process.env.SHOP_PORTAL_OWNERSHIP_ENABLED?.trim(),
});

export type {
  PortalDocumentItem,
  PortalEditionItem,
  PortalPayeeConnectView,
  PortalPayoutItem,
  PortalSaleAuthorityItem,
  PortalSaleAuthorityRequestItem,
  PortalSaleStatementItem,
} from "@auction/shop-portal/portal";

export const {
  fetchPortalEditions,
  fetchPortalCollection,
  fetchPortalEnquiries,
  fetchPortalSaleAuthority,
  fetchPortalSaleAuthorityRequests,
  fetchPortalPayouts,
  fetchPortalSales,
  fetchPortalDocuments,
  fetchPortalArtistArtworks,
  fetchPortalArtistSales,
  fetchPortalPayeeConnect,
} = portalFetchers;

/** Storefront hub links follow shop-api when the storefront env flag is unset. */
export const resolveShopPortalOwnershipEnabled = cache(
  portalFetchers.resolveShopPortalOwnershipEnabled,
);

/** Whether the signed-in subject is linked to an artist profile (for account nav). */
export const resolveShopArtistPortalLinked = cache(portalFetchers.resolveShopArtistPortalLinked);
