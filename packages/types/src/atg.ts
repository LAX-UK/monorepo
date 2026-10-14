import type { SaleStatus } from "./sale.js";

/** LAX-side lifecycle of a sale pushed to the ATG White Label. */
export type AtgRemoteStatus = "pending" | "created" | "approved" | "published" | "closed";

export type AtgSyncAction = "push" | "publish" | "close";

/** Which platform may take bids for this sale (computed; not stored). */
export type AtgSellingPlatform = "free" | "lax" | "atg";

export type AtgOwnershipState = AtgSellingPlatform | "cancelled";

export type ResolveSaleSellingPlatformInput = {
  saleStatus: SaleStatus;
  atgRemoteStatus: AtgRemoteStatus | null;
  /** At least one row in `atg_auction_link`. */
  atgLinked: boolean;
  atgSoldLotCount: number;
};

/**
 * Single source of truth for the one-platform-per-sale rule.
 * LAX draft + ATG draft/closed-with-no-sales => free; LAX published => lax; ATG published or closed-with-sales => atg.
 */
export function resolveSaleSellingPlatform(
  input: ResolveSaleSellingPlatformInput,
): AtgOwnershipState {
  const { saleStatus, atgRemoteStatus, atgSoldLotCount } = input;
  if (saleStatus === "cancelled") return "cancelled";
  if (saleStatus === "scheduled" || saleStatus === "active" || saleStatus === "ended") {
    return "lax";
  }
  if (atgRemoteStatus === "published") return "atg";
  if (atgRemoteStatus === "closed" && atgSoldLotCount >= 1) return "atg";
  return "free";
}

export function canPublishSaleOnLax(state: AtgOwnershipState): boolean {
  return state === "free";
}

export function canPushOrPublishSaleOnAtg(state: AtgOwnershipState): boolean {
  return state !== "cancelled" && state !== "lax";
}

export type AtgSaleOwnershipSnapshot = {
  saleStatus: SaleStatus;
  atgRemoteStatus: AtgRemoteStatus | null;
  atgLinked: boolean;
  atgSoldLotCount: number;
  sellingPlatform: AtgOwnershipState;
};

export type AtgLotChannelState = {
  linked: boolean;
  numberOfBids: number;
  sold: boolean;
};

export type AtgIntegrationStatus = {
  enabled: boolean;
  whiteLabelBaseUrl: string | null;
};

/** BullMQ job visibility for the admin ATG tab. */
export type AtgSyncJobState = "waiting" | "active" | "failed" | "done";

/** One `GetSaleResults` row as stored by the worker (no bidder names). */
export type AtgSaleResultRow = {
  atgLotId: string | null;
  lotNumber: string | null;
  lotStatus: string | null;
  numberOfBids: number | null;
  paddleNumber: string | null;
  hammerPrice: number | null;
  totalHammerPrice: number | null;
  endTimeUtc: string | null;
};

export type AtgLotSyncView = {
  lotId: string;
  lotNumber: number | null;
  title: string;
  atgLotId: string | null;
  imageCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** Raw GAP lot status code; GAP does not document its values, so do not display it. */
  remoteStatus: string | null;
  sold: boolean | null;
  hammerPrice: string | null;
  currentMaxBid: string | null;
  numberOfBids: number | null;
  lastPolledAt: string | null;
};

export type AtgSaleSyncView = {
  saleId: string;
  saleStatus: SaleStatus;
  sellingPlatform: AtgOwnershipState;
  /** Cancelled in LAX: push and publish are refused; a linked auction can still be closed. */
  saleCancelled: boolean;
  linked: boolean;
  atgAuctionId: string | null;
  remoteStatus: AtgRemoteStatus | null;
  publishedAt: string | null;
  closedAt: string | null;
  lastSyncedAt: string | null;
  lastPolledAt: string | null;
  lastError: string | null;
  results: AtgSaleResultRow[];
  lots: AtgLotSyncView[];
};
