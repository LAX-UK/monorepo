/** A bank-transfer payment and the reference its sender is told to quote. */
export type TransferReferenceRecord = {
  stripePaymentIntentId: string;
  reference: string;
  paymentId: string | null;
  paymentGroupId: string | null;
};

/**
 * The reference each bank-transfer payment shows its sender, kept for after the payment provider
 * stops showing it (once the payment completes).
 */
export interface IPaymentTransferReferenceStore {
  /** Idempotent: a payment's reference is recorded once; recording it again changes nothing. */
  remember(record: TransferReferenceRecord): Promise<void>;
  findByPaymentIntent(stripePaymentIntentId: string): Promise<TransferReferenceRecord | null>;
  /** The payment a reference was issued for (compared without regard to case), or null. */
  findByReference(reference: string): Promise<TransferReferenceRecord | null>;
}
