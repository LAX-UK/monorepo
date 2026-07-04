import type { IPaymentWriteRepository } from "@auction/persistence";
import type { Env } from "../../env.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type {
  ICheckoutRail,
  PaymentCheckoutContext,
  PaymentCheckoutResult,
} from "../interfaces/checkout-rail.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import { createOrRenewCheckoutSession } from "../stripe/stripe-checkout-session-lifecycle.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import {
  buildCreateCheckoutSessionInput,
  resolveCheckoutLotHeroImage,
} from "./stripe-checkout-product-display.js";

export class CardCheckoutRail implements ICheckoutRail {
  readonly kind = "card" as const;

  constructor(
    private readonly env: Pick<Env, "WEB_ORIGIN">,
    private readonly gateway: IStripePaymentGateway,
    private readonly payments: IPaymentWriteRepository,
    private readonly mediaUrlResolver?: MediaUrlResolver,
  ) {}

  async createCheckout(ctx: PaymentCheckoutContext): Promise<PaymentCheckoutResult> {
    if (!this.gateway.isConfigured()) {
      return {
        checkoutUrl: null,
        checkoutRail: null,
        error: "Stripe is not configured",
        errorCode: "stripe_checkout_unavailable",
      };
    }
    const webOrigin = this.env.WEB_ORIGIN.replace(/\/$/, "");
    const successUrl = `${webOrigin}/dashboard/checkout/${ctx.lot.id}?payment=success`;
    const cancelUrl = `${webOrigin}/dashboard/checkout/${ctx.lot.id}?payment=cancelled`;

    try {
      const imageUrl = await resolveCheckoutLotHeroImage(ctx.lot, this.mediaUrlResolver);
      const outcome = await createOrRenewCheckoutSession(
        this.gateway,
        "card",
        ctx.paymentId,
        (idempotencyKey) =>
          this.gateway.createCardCheckoutSession(
            buildCreateCheckoutSessionInput(ctx, {
              successUrl,
              cancelUrl,
              idempotencyKey,
              imageUrl,
            }),
          ),
      );

      if (outcome.kind === "already_complete") {
        recordMoneyPathEvent("stripe_checkout_already_complete");
        return {
          checkoutUrl: null,
          checkoutRail: null,
          error: "Checkout already completed; payment confirmation is pending",
          errorCode: "stripe_checkout_already_complete",
        };
      }
      if (outcome.kind === "unavailable") {
        return {
          checkoutUrl: null,
          checkoutRail: null,
          error: outcome.error,
          errorCode: "stripe_checkout_unavailable",
        };
      }

      const session = outcome.session;
      if (session.paymentIntentId) {
        await this.payments.updateStripePaymentIntentId(ctx.paymentId, session.paymentIntentId);
      }
      recordMoneyPathEvent("stripe_checkout_created_card");
      return { checkoutUrl: session.url, checkoutRail: "card" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        checkoutUrl: null,
        checkoutRail: null,
        error: msg,
        errorCode: "stripe_checkout_unavailable",
      };
    }
  }
}
