import type { Database } from "@auction/db";

/** Which offer a sweep should look at, and the lot to lock first. */
export type ReofferSweepRef = { reofferId: string; lotId: string };

/**
 * What the clock sweeps read: the offers and requests that might need it. A listing is only a
 * pointer; the sweep takes the lot's and the offer's locks and re-reads everything under them
 * before it acts, so a stale listing never changes anything.
 */
export interface IReofferSweepReader {
  /** Offers waiting on the seller, whose request is still open, earliest deadline first. */
  openSellerRequests(limit: number): Promise<ReofferSweepRef[]>;
  /** The id of the lot's most recent buyer default; the only thing of a default the clock reads. */
  latestDefaultId(db: Database, lotId: string): Promise<string | null>;
  /** Offers that are out with a bidder, earliest end first. */
  offersOut(limit: number): Promise<ReofferSweepRef[]>;
  /**
   * Accepted offers whose lot was re-awarded before `reawardedBefore` and whose new buyer's account
   * has no live invoice on the lot: the re-award committed, but raising the invoice did not.
   * Lots that were deleted, whose buyer account differs from the offer's, and offers already marked
   * as unraisable are left out.
   */
  acceptedWithoutInvoice(input: {
    reawardedBefore: Date;
    limit: number;
  }): Promise<ReofferSweepRef[]>;
}

/** Records that the sweep tried an accepted offer's invoice and was told it cannot be raised. */
export interface IReofferInvoiceMarker {
  /** True when this call set the marker; false when the offer was not accepted or already marked. */
  markInvoiceNotRaised(reofferId: string, marker: string): Promise<boolean>;
}
