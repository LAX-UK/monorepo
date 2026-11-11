/** A bank-transfer payment and the reference its sender is told to quote. */
export type TransferReferenceRecord = {
  stripePaymentIntentId: string;
  reference: string;
  /** The buyer's customer at the provider; null when the payment had none. */
  stripeCustomerId: string | null;
  paymentId: string | null;
  paymentGroupId: string | null;
  /** The invoices the combined payment held when the reference was shown; empty otherwise. */
  memberPaymentIds: string[];
  privateSaleDealId: string | null;
  privateSaleDealPaymentId: string | null;
};

/**
 * The reference each bank-transfer payment shows its sender, kept for after the payment provider
 * stops showing it (once the payment completes). Only references we issued are held.
 */
export interface IPaymentTransferReferenceStore {
  /** Idempotent: a payment's reference is recorded once; recording it again changes nothing. */
  remember(record: TransferReferenceRecord): Promise<void>;
  findByPaymentIntent(stripePaymentIntentId: string): Promise<TransferReferenceRecord | null>;
  /** One buyer's references, newest first and bounded: a reference is only matched within its buyer. */
  listForCustomer(stripeCustomerId: string, limit: number): Promise<TransferReferenceRecord[]>;
}
