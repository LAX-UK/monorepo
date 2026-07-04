import type { IPaymentWriteRepository } from "@auction/persistence/interfaces";
import type { Env } from "../../env.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type {
  ICheckoutRail,
  PaymentCheckoutContext,
  PaymentCheckoutResult,
} from "../interfaces/checkout-rail.js";
import type { IStripeCustomerGateway } from "../interfaces/stripe-customer.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import { createOrRenewCheckoutSession } from "../stripe/stripe-checkout-session-lifecycle.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import {
  buildCreateCheckoutSessionInput,
  resolveCheckoutLotHeroImage,
} from "./stripe-checkout-product-display.js";

export class BankTransferCheckoutRail implements ICheckoutRail {
  readonly kind = "gb_bank_transfer" as const;

  constructor(
    private readonly env: Pick<Env, "WEB_ORIGIN">,
    private readonly gateway: IStripePaymentGateway,
    private readonly stripeCustomers: IStripeCustomerGateway,
    private readonly payments: IPaymentWriteRepository,
    private readonly mediaUrlResolver?: MediaUrlResolver,
  ) {}

  async createCheckout(ctx: PaymentCheckoutContext): Promise<PaymentCheckoutResult> {
    if (!this.gateway.isConfigured() || !this.stripeCustomers.isConfigured()) {
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
      const stripeCustomerId = await this.stripeCustomers.findOrCreateForLegalEntity({
        legalEntityId: ctx.buyerLegalEntityId,
        buyerEmail: ctx.buyerEmail,
        buyerName: ctx.buyerName,
      });
      const imageUrl = await resolveCheckoutLotHeroImage(ctx.lot, this.mediaUrlResolver);
      const outcome = await createOrRenewCheckoutSession(
        this.gateway,
        "bank",
        ctx.paymentId,
        (idempotencyKey) =>
          this.gateway.createBankTransferCheckoutSession({
            ...buildCreateCheckoutSessionInput(ctx, {
              successUrl,
              cancelUrl,
              idempotencyKey,
              imageUrl,
            }),
            stripeCustomerId,
          }),
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
      recordMoneyPathEvent("stripe_checkout_created_bank_transfer");
      return { checkoutUrl: session.url, checkoutRail: "gb_bank_transfer" };
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
