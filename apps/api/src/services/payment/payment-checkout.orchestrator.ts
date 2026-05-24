import type {
  IPaymentCheckoutProvider,
  PaymentCheckoutContext,
  PaymentCheckoutResult,
} from "../interfaces/payment-checkout.js";

export class PaymentCheckoutOrchestrator {
  constructor(
    private readonly providers: IPaymentCheckoutProvider[],
    private readonly stripeCheckoutExclusive = false,
  ) {}

  async createCheckout(ctx: PaymentCheckoutContext): Promise<PaymentCheckoutResult> {
    const sorted = [...this.providers].sort((a, b) => a.priority - b.priority);
    let lastError: string | undefined;

    for (const provider of sorted) {
      if (!provider.isAvailable()) continue;
      const result = await provider.createCheckout(ctx);
      if (result.checkoutUrl) {
        return result;
      }
      if (result.error) {
        lastError = result.error;
        if (this.stripeCheckoutExclusive && provider.priority === 0) {
          return {
            checkoutUrl: null,
            ...(result.provider ? { provider: result.provider } : {}),
            error: lastError,
          };
        }
      }
    }

    return {
      checkoutUrl: null,
      error: lastError ?? "No checkout provider available",
    };
  }
}
