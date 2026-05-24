import type { Env } from "../../env.js";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type {
  IPaymentCheckoutProvider,
  PaymentCheckoutContext,
  PaymentCheckoutResult,
} from "../interfaces/payment-checkout.js";
import type { IPaymentWriteRepository } from "../interfaces/payment-write.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";

export class StripePlatformCheckoutProvider implements IPaymentCheckoutProvider {
  readonly priority = 0;

  constructor(
    private readonly env: Pick<Env, "WEB_ORIGIN" | "STRIPE_CHECKOUT_ENABLED">,
    private readonly gateway: IStripePaymentGateway,
    private readonly payments: IPaymentWriteRepository,
  ) {}

  isAvailable(): boolean {
    return Boolean(this.env.STRIPE_CHECKOUT_ENABLED) && this.gateway.isConfigured();
  }

  async createCheckout(ctx: PaymentCheckoutContext): Promise<PaymentCheckoutResult> {
    if (!this.isAvailable()) {
      return { checkoutUrl: null, provider: "stripe" };
    }
    const amountCents = gbpAmountToPence(ctx.amount);
    if (amountCents <= 0) {
      return { checkoutUrl: null, provider: "stripe", error: "Invalid amount" };
    }
    const webOrigin = this.env.WEB_ORIGIN.replace(/\/$/, "");
    const successUrl = `${webOrigin}/dashboard/checkout/${ctx.lot.id}?payment=success`;
    const cancelUrl = `${webOrigin}/dashboard/checkout/${ctx.lot.id}?payment=cancelled`;

    try {
      const session = await this.gateway.createCheckoutSession({
        paymentId: ctx.paymentId,
        lotId: ctx.lot.id,
        amountCents,
        currency: "gbp",
        buyerEmail: ctx.buyerEmail,
        successUrl,
        cancelUrl,
      });
      if (session.paymentIntentId) {
        await this.payments.updateStripePaymentIntentId(ctx.paymentId, session.paymentIntentId);
      }
      recordMoneyPathEvent("stripe_checkout_created");
      return { checkoutUrl: session.url, provider: "stripe" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { checkoutUrl: null, provider: "stripe", error: msg };
    }
  }
}
