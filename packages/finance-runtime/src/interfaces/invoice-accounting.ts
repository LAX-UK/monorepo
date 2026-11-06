import type { Lot } from "@auction/types";

/** Context to create an external (Xero) ACCREC invoice for a local payment row. */
export type InvoiceAccountingContext = {
  paymentId: string;
  lot: Lot;
  buyerEmail: string;
  buyerName: string;
  amount: string;
  /**
   * When the payment row was raised. The books copy is dated and due from the stored invoice
   * (its raised and due dates), which the writer reads by payment id.
   */
  raisedAt: Date;
  buyerLegalEntityId?: string | undefined;
};

/** Accounting ledger provider (invoices + reconciliation). No buyer checkout URLs. */
export interface IInvoiceAccountingProvider {
  isConfigured(): boolean;

  ensureInvoiceForPayment(ctx: InvoiceAccountingContext): Promise<{ ok: boolean; error?: string }>;

  syncPaymentFromProvider(paymentId: string): Promise<{ ok: boolean; error?: string }>;

  syncInvoiceFromProvider(
    tenantId: string,
    invoiceId: string,
  ): Promise<{ ok: boolean; error?: string }>;
}
