/**
 * A bank transfer carries the payment reference of the invoice it was sent for. The payment
 * provider can still apply the money to another open payment of the same buyer (for instance when
 * the invoice it was sent for had been closed). Nothing is lost, but the money is then recorded
 * against the wrong invoice, so finance is told. These rules decide when that has happened.
 */

/** One transfer that reached a buyer's balance, as the provider's ledger reports it. */
export type TransferFunding = {
  id: string;
  /** Unix seconds. */
  createdAt: number;
  /** The reference the sender quoted; null when none was given. */
  reference: string | null;
};

const normalise = (reference: string): string => reference.trim().toUpperCase();

/**
 * The transfer that supplied money applied at `appliedAt`: the latest one received at or before
 * it. Null when none is known, or when that transfer carried no reference.
 */
export function fundingThatSuppliedApplication(
  fundings: readonly TransferFunding[],
  appliedAt: number,
): TransferFunding | null {
  let nearest: TransferFunding | null = null;
  for (const funding of fundings) {
    if (funding.createdAt > appliedAt) continue;
    if (!nearest || funding.createdAt > nearest.createdAt) nearest = funding;
  }
  return nearest?.reference?.trim() ? nearest : null;
}

/**
 * Whether money was applied to a payment other than the one whose reference the sender used.
 * Both references must be known: with either missing nothing can be said, so it is not a mismatch.
 */
export function isTransferAppliedToOtherPayment(input: {
  sentWithReference: string | null;
  paymentOwnReference: string | null;
}): boolean {
  const sent = input.sentWithReference?.trim();
  const own = input.paymentOwnReference?.trim();
  if (!sent || !own) return false;
  return normalise(sent) !== normalise(own);
}
