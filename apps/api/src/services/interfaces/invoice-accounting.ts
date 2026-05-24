import type { Lot } from "@auction/types";

/** Context to create an external (Xero) ACCREC invoice for a local payment row. */
export type InvoiceAccountingContext = {
  paymentId: string;
  lot: Lot;
  buyerEmail: string;
  buyerName: string;
  amount: string;
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
