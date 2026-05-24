import type {
  ICheckoutRail,
  IStripeCheckoutService,
  PaymentCheckoutContext,
  PaymentCheckoutResult,
} from "../interfaces/checkout-rail.js";
import type { CheckoutRailKind } from "./payment-tier.policy.js";

export class StripeCheckoutService implements IStripeCheckoutService {
  private readonly railsByKind: Map<CheckoutRailKind, ICheckoutRail>;

  constructor(rails: ICheckoutRail[]) {
    this.railsByKind = new Map(rails.map((r) => [r.kind, r]));
  }

  isAvailable(): boolean {
    return this.railsByKind.size > 0;
  }

  async createCheckout(
    rail: CheckoutRailKind,
    ctx: PaymentCheckoutContext,
  ): Promise<PaymentCheckoutResult> {
    const handler = this.railsByKind.get(rail);
    if (!handler) {
      return {
        checkoutUrl: null,
        checkoutRail: null,
        error: `Checkout rail not configured: ${rail}`,
        errorCode: "stripe_checkout_unavailable",
      };
    }
    return handler.createCheckout(ctx);
  }
}
