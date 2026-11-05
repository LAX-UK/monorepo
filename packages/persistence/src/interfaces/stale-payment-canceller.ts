/** Cancels an unpaid invoice for being stale, only if nothing touched it while it was checked. */
export interface IStalePaymentCanceller {
  /**
   * Cancels the invoice while it is still unpaid (pending or authorised), not held by a "Pay
   * several" payment, and no checkout was opened for it at or after `since`. False otherwise, and
   * the next run looks again.
   */
  cancelIfUntouchedSince(paymentId: string, since: Date): Promise<boolean>;
}
