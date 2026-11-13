import type {
  IStripeRefundWatchRepository,
  StripeRefundSighting,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { executeWithStripeRetries } from "../../lib/stripe-retries.js";
import { type ChargeRefund, isUnsettledRefund } from "./stripe-refund-status.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const idOf = (ref: string | { id: string } | null | undefined): string | null =>
  typeof ref === "string" ? ref : (ref?.id ?? null);

export function chargeRefundOf(refund: Stripe.Refund): ChargeRefund {
  return {
    id: refund.id,
    chargeId: idOf(refund.charge) ?? "",
    amountPence: refund.amount,
    status: refund.status ?? "",
    paymentId: refund.metadata?.paymentId ?? null,
    deliveryQuoteId: refund.metadata?.deliveryQuoteId ?? null,
  };
}

/** Reads a charge's refunds from Stripe, which is the one source of truth for what went back. */
export interface IChargeRefundsReader {
  /** Every refund on the charge, whatever its status. Unsettled ones are watched as a side effect. */
  listChargeRefunds(chargeId: string): Promise<ChargeRefund[]>;
  retrieveRefund(refundId: string): Promise<ChargeRefund>;
  retrieveCharge(chargeId: string): Promise<Stripe.Charge>;
}

/**
 * Stripe's refunds for a charge. Each refund still pending or requiring action is written to the
 * refund watch, so the reconcile job reads it again until it is final, whether or not the
 * payments endpoint receives `charge.refund.updated`.
 */
export class StripeChargeRefunds implements IChargeRefundsReader {
  constructor(
    private readonly stripeFactory: IStripeClientFactory,
    private readonly watch: Pick<IStripeRefundWatchRepository, "watch"> | null = null,
  ) {}

  async listChargeRefunds(chargeId: string): Promise<ChargeRefund[]> {
    const stripe = this.stripeFactory.require();
    const refunds: ChargeRefund[] = [];
    for await (const refund of stripe.refunds.list({ charge: chargeId, limit: 100 })) {
      refunds.push({ ...chargeRefundOf(refund), chargeId });
    }
    await this.watchUnsettled(refunds);
    return refunds;
  }

  async retrieveRefund(refundId: string): Promise<ChargeRefund> {
    const stripe = this.stripeFactory.require();
    const refund = await executeWithStripeRetries(() => stripe.refunds.retrieve(refundId));
    return chargeRefundOf(refund);
  }

  retrieveCharge(chargeId: string): Promise<Stripe.Charge> {
    const stripe = this.stripeFactory.require();
    return executeWithStripeRetries(() => stripe.charges.retrieve(chargeId));
  }

  /** Starts watching refunds that are not final yet; a refund already watched is left alone. */
  async watchUnsettled(refunds: readonly ChargeRefund[]): Promise<void> {
    if (!this.watch) return;
    const sightings: StripeRefundSighting[] = refunds
      .filter((r) => isUnsettledRefund(r.status) && r.chargeId)
      .map((r) => ({
        stripeRefundId: r.id,
        stripeChargeId: r.chargeId,
        status: r.status,
        amountPence: r.amountPence,
        paymentId: r.paymentId && UUID.test(r.paymentId) ? r.paymentId : null,
      }));
    if (sightings.length > 0) await this.watch.watch(sightings);
  }
}
