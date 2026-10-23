/**
 * What a person still has in flight in LAX Shop and lax.art, as counts. The counts are facts
 * about rows; what they mean for account deletion, and how it is worded, is decided by the
 * deletion-eligibility service.
 */
export type ShopDeletionOpenItems = {
  /**
   * Orders awaiting payment (while their checkout is still open) and paid orders whose
   * fulfilment has not reached delivery, collection or storage.
   */
  openOrders: number;
  /** Payouts owed to the person (as an artist or other payee) that have not been paid out. */
  pendingPayouts: number;
  /** Original-work sales to the person that are still between reservation and handover. */
  openOriginalSales: number;
  /** Works a broker is holding for the person while they decide. */
  activeHolds: number;
};

export interface ShopDeletionEligibilityReader {
  readOpenItems(identitySubjectId: string): Promise<ShopDeletionOpenItems>;
}
