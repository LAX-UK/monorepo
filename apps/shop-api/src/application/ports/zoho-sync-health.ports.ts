import type { OfferState } from "@auction/artwork-register-contracts";

/**
 * What the Sync health tab needs from the Zoho sync's own records. The container connects these
 * ports to the persistence readers.
 */

export type ZohoRunMode = "off" | "dry_run" | "live";

export type ZohoSyncHealthRecord = {
  modes: { artworkSync: ZohoRunMode; listing: ZohoRunMode } | null;
  modesReportedAt: Date | null;
  token: {
    refreshedAt: Date | null;
    expiresAt: Date | null;
    failureStreak: number;
    lastFailureAt: Date | null;
  };
};

export interface ZohoSyncHealthReader {
  read(): Promise<ZohoSyncHealthRecord | null>;
}

export interface ZohoOutboundQueueReader {
  stats(): Promise<{ depth: number; oldestPendingAt: Date | null; deadLettered: number }>;
}

export type DriftPaging = { limit: number; offset: number };
export type DriftPage<Row> = { rows: Row[]; total: number };

export type ZohoDriftReader = {
  counts(): Promise<{
    registerWithoutProduct: number;
    productsWithoutRegister: number;
    statusMismatches: number;
  }>;
  registerWithoutProduct(paging: DriftPaging): Promise<
    DriftPage<{
      registerId: string;
      stockCode: string;
      title: string;
      artistName: string;
      offerState: OfferState;
      foundAt: Date;
    }>
  >;
  productsWithoutRegister(paging: DriftPaging): Promise<
    DriftPage<{
      zohoProductId: string;
      stockCode: string | null;
      title: string | null;
      reason: string | null;
      foundAt: Date;
    }>
  >;
  statusMismatches(paging: DriftPaging): Promise<
    DriftPage<{
      registerId: string;
      stockCode: string;
      title: string;
      artistName: string;
      offerState: OfferState;
      zohoStatus: string | null;
      expectedStatus: string;
    }>
  >;
};
