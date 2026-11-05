/** Cancels an unpaid invoice for being stale, only if nothing touched it while it was checked. */
export interface IStalePaymentCanceller {
  /**
   * Cancels the invoice while it is still unpaid (pending or authorised), not held by a "Pay
   * several" payment, and no checkout was opened for it at or after `since`. False otherwise, and
   * the next run looks again.
   */
  cancelIfUntouchedSince(paymentId: string, since: Date): Promise<boolean>;
  /** The database's clock, so "since" is compared with the same clock that stamps sessions. */
  now(): Promise<Date>;
  /**
   * Unpaid invoices (not in a "Pay several" payment) that have a Stripe checkout or intent, with
   * who pays them, oldest first: what a hold has to close.
   */
  listUnpaidWithCheckout(
    limit: number,
  ): Promise<{ id: string; payerUserId: string; buyerLegalEntityId: string }[]>;
}
