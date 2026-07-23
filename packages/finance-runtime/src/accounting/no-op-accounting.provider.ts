import type {
  IInvoiceAccountingProvider,
  InvoiceAccountingContext,
} from "../interfaces/invoice-accounting.js";

export class NoOpAccountingProvider implements IInvoiceAccountingProvider {
  isConfigured(): boolean {
    return false;
  }

  async ensureInvoiceForPayment(
    _ctx: InvoiceAccountingContext,
  ): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "Accounting provider not configured" };
  }

  async syncPaymentFromProvider(_paymentId: string): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "Accounting provider not configured" };
  }

  async syncInvoiceFromProvider(
    _tenantId: string,
    _invoiceId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "Accounting provider not configured" };
  }
}
