/** LAX-side lifecycle of a sale pushed to the ATG White Label. */
export type AtgRemoteStatus = "pending" | "created" | "approved" | "published" | "closed";

export type AtgSyncAction = "push" | "publish" | "close";

export type AtgIntegrationStatus = {
  enabled: boolean;
  whiteLabelBaseUrl: string | null;
};

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
