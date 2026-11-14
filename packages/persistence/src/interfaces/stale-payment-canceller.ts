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
  /**
   * Open "Pay several" payments that have a Stripe checkout or intent, oldest first, with who
   * pays them and who pays each of their unpaid invoices: a hold on any of them closes the
   * group's checkout. Groups whose money is on its way (processing) are not listed.
   */
  listOpenGroupsWithCheckout(limit: number): Promise<OpenGroupCheckout[]>;
}

export type OpenGroupCheckout = {
  id: string;
  /** Who opened the group's checkout; null when that member's record is gone. */
  payerUserId: string | null;
  buyerLegalEntityId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  members: { paymentId: string; payerUserId: string; buyerLegalEntityId: string }[];
};
