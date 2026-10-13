import type { AtgRemoteLot, AtgSaleResult } from "./atg-gateway.js";
import type { AtgAuctionLink, AtgLotLink, AtgRemoteStatus, AtgSaleSnapshot } from "./atg-types.js";

export type AtgAuctionLinkPatch = Partial<{
  atgAuctionId: string;
  atgAuctionReference: string;
  remoteStatus: AtgRemoteStatus;
  publishedAt: Date;
  closedAt: Date;
  payloadHash: string;
  lastSyncedAt: Date;
  lastPolledAt: Date;
  lastError: string | null;
  resultsSnapshot: AtgSaleResult[];
}>;

export type AtgLotLinkPatch = Partial<{
  imageNames: string[];
  payloadHash: string;
  lastSyncedAt: Date;
  lastError: string | null;
}>;

/** Persistence port for ATG link state and the LAX catalogue reads the sync needs. */
export interface AtgSyncStore {
  loadSale(saleId: string): Promise<AtgSaleSnapshot | null>;
  getAuctionLink(saleId: string): Promise<AtgAuctionLink | null>;
  /** Inserts the link row when missing, then applies the patch. */
  saveAuctionLink(saleId: string, patch: AtgAuctionLinkPatch): Promise<void>;
  listLotLinks(saleId: string): Promise<AtgLotLink[]>;
  getLotLink(lotId: string): Promise<AtgLotLink | null>;
  /** Links for the given LAX lots, whichever sale they were pushed under. */
  findLotLinks(lotIds: string[]): Promise<AtgLotLink[]>;
  insertLotLink(
    link: Pick<AtgLotLink, "lotId" | "saleId" | "atgLotId"> & { payloadHash: string },
  ): Promise<void>;
  updateLotLink(lotId: string, patch: AtgLotLinkPatch): Promise<void>;
  deleteLotLink(lotId: string): Promise<void>;
  /** Writes polled remote state onto the matching lot links; unknown ATG lots are ignored. */
  applyRemoteLots(saleId: string, lots: AtgRemoteLot[], polledAt: Date): Promise<void>;
  /** Linked sales that are live on ATG, or closed on/after `closedSince`. */
  listActiveAuctionLinks(closedSince: Date): Promise<AtgAuctionLink[]>;
  /** True when the sale or any of its lots changed after `since`. */
  hasCatalogueChangesSince(saleId: string, since: Date): Promise<boolean>;
}
