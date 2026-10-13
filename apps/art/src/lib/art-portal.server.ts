import { artCatalogueApiServerUrl } from "@/lib/art-catalogue.server";
import { artCommerceRequest } from "@/lib/art-commerce-request.server";
import { createPortalFetchers } from "@auction/shop-portal/portal";
import { cache } from "react";

const portalFetchers = createPortalFetchers({
  commerceRequest: artCommerceRequest,
  shopApiServerUrl: artCatalogueApiServerUrl,
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
  fetchPortalGeneralEnquiries,
  fetchPortalSavedArtworks,
  fetchPortalFollowedArtists,
  fetchPortalSaleAuthority,
  fetchPortalSaleAuthorityRequests,
  fetchPortalPayouts,
  fetchPortalSales,
  fetchPortalDocuments,
  fetchPortalArtistArtworks,
  fetchPortalArtistSales,
  fetchPortalPayeeConnect,
} = portalFetchers;

export const resolveArtPortalOwnershipEnabled = cache(
  portalFetchers.resolveShopPortalOwnershipEnabled,
);

export const resolveArtArtistPortalLinked = cache(portalFetchers.resolveShopArtistPortalLinked);
