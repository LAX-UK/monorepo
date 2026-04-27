import type { Lot } from "@auction/types";

/** Context to create an external (Xero) invoice for a local payment row. */
export type AccountingCheckoutContext = {
  paymentId: string;
  lot: Lot;
  buyerEmail: string;
  buyerName: string;
  amount: string;
};

export type AccountingCheckoutResult = {
  checkoutUrl: string | null;
  error?: string;
};

/**
 * Optional accounting / hosted checkout provider (e.g. Xero online invoice).
 * When disabled, `checkoutUrl` is always null and local payment rows still work.
 */
export interface IPaymentAccountingProvider {
  isConfigured(): boolean;

  /** If a prior checkout row exists with an online URL, return it (idempotent checkout). */
  getCheckoutUrlIfAny(paymentId: string): Promise<string | null>;

  createCheckoutForWinner(ctx: AccountingCheckoutContext): Promise<AccountingCheckoutResult>;

  /** Pull invoice state from the provider and align local payment status. */
  syncPaymentFromProvider(paymentId: string): Promise<{ ok: boolean; error?: string }>;

  /** Used by webhooks when only Xero invoice id is known. */
  syncInvoiceFromProvider(
    tenantId: string,
    invoiceId: string,
  ): Promise<{ ok: boolean; error?: string }>;
}
