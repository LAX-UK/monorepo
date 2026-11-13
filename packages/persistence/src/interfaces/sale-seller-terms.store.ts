import type { SellerTermsSnapshot } from "@auction/domain";

/** A seller-terms snapshot as stored: the row's id and what it says. */
export type StoredSellerTerms = { id: string; snapshot: SellerTermsSnapshot };

/** One line of a buyer's invoice, as the seller's side is priced from it. */
export type StoredInvoiceLine = { kind: string; amountPence: number };

/**
 * Where settlement keeps the seller-terms snapshot of a sale it pays. Settlement prices a sale only
 * when its snapshot is missing (raised before snapshots) or held; a priced row is never changed.
 */
export interface ISaleSellerTermsStore {
  /** The stored lines of the invoice a payment was raised on, or `null` when it has none. */
  invoiceLinesForPayment(paymentId: string): Promise<StoredInvoiceLine[] | null>;
  /**
   * Stores the snapshot of a payment raised before snapshots, priced at payout, beside its old-rule
   * fee. If another run stored one first, that row is returned unchanged.
   */
  recordAtPayout(input: {
    paymentId: string;
    snapshot: SellerTermsSnapshot;
    legacyPlatformFeePence: number | null;
  }): Promise<StoredSellerTerms>;
  /**
   * Stores a held sale's new pricing over its row. Only a row that is still held changes: the
   * payment, lot, seller, hammer, premium and old-rule fee stay as they were raised.
   */
  repriceHeld(id: string, snapshot: SellerTermsSnapshot): Promise<StoredSellerTerms>;
}
