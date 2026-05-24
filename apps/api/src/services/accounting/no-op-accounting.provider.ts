import type {
  AccountingCheckoutContext,
  AccountingCheckoutResult,
  IPaymentAccountingProvider,
} from "../interfaces/payment-accounting-provider.js";

export class NoOpAccountingProvider implements IPaymentAccountingProvider {
  isConfigured(): boolean {
    return false;
  }

  async getCheckoutUrlIfAny(_paymentId: string): Promise<string | null> {
    return null;
  }

  async createCheckoutForWinner(
    _ctx: AccountingCheckoutContext,
  ): Promise<AccountingCheckoutResult> {
    return { checkoutUrl: null };
  }

  async ensureInvoiceForPayment(
    _ctx: AccountingCheckoutContext,
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
