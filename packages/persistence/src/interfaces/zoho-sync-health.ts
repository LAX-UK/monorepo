import type { OfferState } from "@auction/artwork-register-contracts";

/** How a Zoho sync runs: not at all, reporting only, or applying its changes. */
export type ZohoSyncRunMode = "off" | "dry_run" | "live";

/** The sync modes the worker runs with, as it last reported them. */
export type ZohoSyncModes = {
  artworkSync: ZohoSyncRunMode;
  listing: ZohoSyncRunMode;
};

/** How the Zoho OAuth token refresh is doing. */
export type ZohoTokenHealth = {
  /** The last time Zoho gave the worker a fresh access token; null before the first. */
  refreshedAt: Date | null;
  /** When that access token stops working. */
  expiresAt: Date | null;
  /** Refreshes that failed since the last good one. */
  failureStreak: number;
  lastFailureAt: Date | null;
  /** A short code, never Zoho's response text. */
  lastFailureCode: string | null;
};

export type ZohoSyncHealthRecord = {
  /** Null until the worker has reported once. */
  modes: ZohoSyncModes | null;
  modesReportedAt: Date | null;
  token: ZohoTokenHealth;
};

/** Where the worker keeps what staff need to see about the Zoho connection. */
export interface IZohoSyncHealthStore {
  reportModes(modes: ZohoSyncModes, now: Date): Promise<void>;
  /** A refresh worked: the streak ends. */
  recordTokenRefreshed(expiresAt: Date, now: Date): Promise<void>;
  /** A refresh failed; returns how many have failed in a row, this one included. */
  recordTokenRefreshFailed(code: string, now: Date): Promise<{ failureStreak: number }>;
}

/** What LAX Admin reads. Null before the worker has reported anything. */
export interface IZohoSyncHealthReader {
  read(): Promise<ZohoSyncHealthRecord | null>;
}

/** The writes to Zoho Products that have not finished, and the ones that gave up. */
export type ZohoOutboundQueueStats = {
  /** Waiting, in progress or waiting to be tried again. */
  depth: number;
  /** When the longest-waiting of those was queued; null when none are. */
  oldestPendingAt: Date | null;
  /** Gave up after their retries and wait in Failed jobs. */
  deadLettered: number;
};

export interface IZohoOutboundQueueReader {
  stats(): Promise<ZohoOutboundQueueStats>;
}

export type ZohoDriftPaging = { limit: number; offset: number };
export type ZohoDriftPage<Row> = { rows: Row[]; total: number };

/** A register artwork whose Zoho Product is gone. */
export type RegisterWithoutProductRow = {
  registerId: string;
  zohoProductId: string;
  stockCode: string;
  title: string;
  artistName: string;
  offerState: OfferState;
  /** When a check found the Product missing. */
  foundAt: Date;
};

/** A Zoho Product the register has no entry for. */
export type ProductWithoutRegisterRow = {
  zohoProductId: string;
  stockCode: string | null;
  title: string | null;
  /** Why the check left it out; null when a dry run would add it. */
  reason: string | null;
  foundAt: Date;
};

/** A register artwork whose Zoho Status is not the one its place in LAX calls for. */
export type StatusMismatchRow = {
  registerId: string;
  stockCode: string;
  title: string;
  artistName: string;
  offerState: OfferState;
  /** The Status Zoho holds; null when Zoho has none. */
  zohoStatus: string | null;
  /** The Status LAX writes for this place. */
  expectedStatus: string;
};

export type ZohoDriftCounts = {
  registerWithoutProduct: number;
  productsWithoutRegister: number;
  statusMismatches: number;
};

/** Where Zoho and LAX disagree about an original, one page at a time. */
export interface IZohoDriftReader {
  counts(): Promise<ZohoDriftCounts>;
  registerWithoutProduct(
    paging: ZohoDriftPaging,
  ): Promise<ZohoDriftPage<RegisterWithoutProductRow>>;
  productsWithoutRegister(
    paging: ZohoDriftPaging,
  ): Promise<ZohoDriftPage<ProductWithoutRegisterRow>>;
  statusMismatches(paging: ZohoDriftPaging): Promise<ZohoDriftPage<StatusMismatchRow>>;
}
