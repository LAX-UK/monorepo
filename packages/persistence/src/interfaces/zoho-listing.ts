import type {
  ArtworkRegisterEntry,
  BidLotStatus,
  BidSaleStatus,
  OfferState,
} from "@auction/artwork-register-contracts";

/** The LAX Bid lot an original is offered in, or its open draft lot, with the lot's sale. */
export type ListingLot = {
  id: string;
  title: string;
  lotNumber: number | null;
  status: BidLotStatus;
  /** Soft-deleted lots are kept so a sold artwork still names the lot that sold it. */
  deleted: boolean;
  /** ATG reports the lot sold: it has no LAX winner, so the listing needs this to say so. */
  soldOnAtg: boolean;
  sale: {
    id: string;
    title: string;
    status: BidSaleStatus;
    startTime: Date;
    endTime: Date;
    /** An internal test sale: never public. */
    isTest: boolean;
  } | null;
};

/** The latest offer move in the register's history. */
export type ListingMove = { at: Date; from: OfferState | null; to: OfferState };

/** What LAX Bid and the register hold about an original, for its listing on the Zoho Product. */
export type RegisterListingSource = {
  entry: ArtworkRegisterEntry;
  lastMove: ListingMove | null;
  lot: ListingLot | null;
  privateSale: { id: string; reference: string } | null;
};

/**
 * Reads the register and LAX Bid for the LAX listing on Zoho Products. lax.art's half comes from
 * LAX Shop, which owns those tables. Reads only; nothing here changes a record.
 */
export interface IZohoListingSourceReader {
  /** The sources for these records, originals only, in no particular order. */
  read(registerIds: readonly string[]): Promise<RegisterListingSource[]>;
  /** The record a lot offers, as a list (empty when the lot has none). */
  registerIdsForLot(lotId: string): Promise<string[]>;
  /** Every record offered by a lot of this sale. */
  registerIdsForSale(saleId: string): Promise<string[]>;
  /**
   * Records offered by a lot of a still-`scheduled` sale whose start time is after `from` and no
   * later than `to`: sales that have just started on their own time. In id order after the cursor.
   */
  registerIdsForSalesStartedBetween(
    window: { from: Date; to: Date },
    after: string | null,
    limit: number,
  ): Promise<string[]>;
  /** The record a lax.art listing was made from or is offered through. */
  registerIdsForLaxArtListing(artworkId: string): Promise<string[]>;
  /** Originals in id order after the cursor: the nightly pass walks the whole register. */
  pageOriginals(after: string | null, limit: number): Promise<string[]>;
}

/**
 * Serialises listing writes per artwork. Whoever holds the lock reads the facts after taking it,
 * so a write can never carry a picture older than one already sent.
 */
export interface IZohoListingLock {
  withLock<T>(registerIds: readonly string[], fn: () => Promise<T>): Promise<T>;
}

export type ZohoListingRunMode = "dry_run" | "live";

/** One record the nightly pass could not bring into line, as staff see it. */
export type ZohoListingRunFailure = {
  registerId: string;
  /** Absent when a whole page failed before its records could be read. */
  stockCode?: string;
  code: string;
};

export type ZohoListingRun = {
  runId: string;
  mode: ZohoListingRunMode;
  startedAt: Date;
  finishedAt: Date;
  checked: number;
  /** Corrected in Zoho, or in a dry run, would have been. */
  changed: number;
  unchanged: number;
  failed: number;
  /** The first failures, enough to act on; `failed` holds the full count. */
  failures: ZohoListingRunFailure[];
};

/** The nightly listing pass keeps its result for LAX Admin's "Last check". */
export interface IZohoListingRunStore {
  record(run: ZohoListingRun): Promise<void>;
}

/**
 * How far the frequent sale-start pass has fully covered: the `to` of its last successful run. The
 * next run starts from here, so a delayed or failed run leaves no gap.
 */
export interface IZohoListingSaleStartMark {
  /** The last fully covered instant, or null before the first successful run. */
  lastCoveredTo(): Promise<Date | null>;
  /** Moves the mark forward to `to`; never backwards. */
  markCoveredTo(to: Date): Promise<void>;
}

/** What LAX Admin reads about the listing sync. */
export interface IZohoListingRunReader {
  /** The newest nightly pass, or null before the first one. */
  latestRun(): Promise<ZohoListingRun | null>;
  /** Listing and Status deliveries that gave up after their retries, awaiting a person. */
  countFailedDeliveries(): Promise<number>;
}
