import type { IPaymentAccountingProvider } from "../interfaces/payment-accounting-provider.js";
import type {
  IPaymentCheckoutProvider,
  PaymentCheckoutContext,
  PaymentCheckoutResult,
} from "../interfaces/payment-checkout.js";

export class XeroInvoiceCheckoutProvider implements IPaymentCheckoutProvider {
  readonly priority = 10;

  constructor(private readonly accounting: IPaymentAccountingProvider) {}

  isAvailable(): boolean {
    return this.accounting.isConfigured();
  }

  async createCheckout(ctx: PaymentCheckoutContext): Promise<PaymentCheckoutResult> {
    if (!this.isAvailable()) {
      return { checkoutUrl: null, provider: "xero" };
    }
    const existing = await this.accounting.getCheckoutUrlIfAny(ctx.paymentId);
    if (existing) {
      return { checkoutUrl: existing, provider: "xero" };
    }
    const r = await this.accounting.createCheckoutForWinner(ctx);
    return {
      checkoutUrl: r.checkoutUrl,
      provider: "xero",
      ...(r.error ? { error: r.error } : {}),
    };
  }
}
