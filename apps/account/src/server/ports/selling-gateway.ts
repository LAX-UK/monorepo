import type {
  PortalPayeeConnectConfig,
  PortalPayeeConnectStatus,
  PortalPayeeConnectSurface,
  PortalPayout,
  PortalSaleAuthority,
  PortalSaleAuthorityRequest,
  PortalSaleStatement,
  PortalSellerAccess,
  parsePortalArtistArtworks,
  parsePortalArtistSales,
} from "@auction/shop-contracts";
import type { SessionHandle } from "./portfolio-gateway";

/**
 * What one read of the person's seller records answered. `off` means Shop has the seller tools
 * switched off in this environment, which is a definite "nothing to show"; `unavailable` is any
 * other failure (no URL, token refused, timeout, error status, body off-contract).
 */
export type SellingRead<T> =
  | { status: "ok"; data: T }
  | { status: "off" }
  | { status: "unavailable" };

/** What a change answered: done, refused with a reason the page can explain, or not reached. */
export type SellingWrite<T> =
  | { status: "ok"; data: T }
  | { status: "rejected"; reason: "conflict" | "not_found" | "invalid" | "forbidden" }
  | { status: "signed_out" }
  | { status: "unavailable" };

export type PortalArtistArtworks = ReturnType<typeof parsePortalArtistArtworks>;
export type PortalArtistSales = ReturnType<typeof parsePortalArtistSales>;

export type PayoutAccountRead = {
  status: PortalPayeeConnectStatus;
  config: PortalPayeeConnectConfig;
};

export type SaleChangeRequest = { artworkId: string; requestedCount: number; note?: string };

/**
 * The person's own seller tools on Shop's API, called as that person with a token that opens
 * those routes only. Every read answers on its own, so one failing never hides the others.
 */
export type SellingGateway = {
  readAccess(handle: SessionHandle): Promise<SellingRead<PortalSellerAccess>>;
  readEditions(handle: SessionHandle): Promise<SellingRead<PortalSaleAuthority[]>>;
  readRequests(handle: SessionHandle): Promise<SellingRead<PortalSaleAuthorityRequest[]>>;
  readSales(handle: SessionHandle): Promise<SellingRead<PortalSaleStatement[]>>;
  readPayouts(handle: SessionHandle): Promise<SellingRead<PortalPayout[]>>;
  readPayoutAccount(handle: SessionHandle): Promise<SellingRead<PayoutAccountRead>>;
  readArtistArtworks(handle: SessionHandle): Promise<SellingRead<PortalArtistArtworks>>;
  readArtistSales(handle: SessionHandle): Promise<SellingRead<PortalArtistSales>>;
  requestSaleChange(
    handle: SessionHandle,
    request: SaleChangeRequest,
  ): Promise<SellingWrite<{ requestId: string }>>;
  withdrawRequest(
    handle: SessionHandle,
    requestId: string,
  ): Promise<SellingWrite<{ requestId: string }>>;
  createPayoutSession(
    handle: SessionHandle,
    surface: PortalPayeeConnectSurface,
  ): Promise<SellingWrite<{ clientSecret: string }>>;
};
