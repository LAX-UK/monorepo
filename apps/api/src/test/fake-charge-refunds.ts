import type { IStripeRefundWatchRepository } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type { IChargeRefundsReader } from "../services/stripe/stripe-charge-refunds.js";
import type { ChargeRefund } from "../services/stripe/stripe-refund-status.js";

/**
 * Stripe's refunds for each charge, as a test sets them. Statuses are moved on with `setStatus`,
 * as Stripe would, and `charges` answers `retrieveCharge`.
 */
export class FakeChargeRefunds implements IChargeRefundsReader {
  /** Where unfinished refunds are watched, as the Stripe reader does; absent in unit tests. */
  constructor(private readonly watch: Pick<IStripeRefundWatchRepository, "watch"> | null = null) {}

  readonly refunds: ChargeRefund[] = [];
  readonly charges = new Map<string, Stripe.Charge>();
  readonly watched: ChargeRefund[] = [];

  add(
    refund: Partial<ChargeRefund> & Pick<ChargeRefund, "chargeId" | "amountPence" | "status">,
  ): ChargeRefund {
    const full: ChargeRefund = {
      id: refund.id ?? `re_${this.refunds.length + 1}`,
      paymentId: null,
      deliveryQuoteId: null,
      ...refund,
    };
    this.refunds.push(full);
    return full;
  }

  /** One succeeded refund of `amountPence` on the charge (what an old test's amount_refunded meant). */
  succeeded(chargeId: string, amountPence: number): this {
    if (amountPence > 0) this.add({ chargeId, amountPence, status: "succeeded" });
    return this;
  }

  /** Stripe now lists `amountPence` as refunded and succeeded on the charge, as one refund. */
  show(chargeId: string, amountPence: number): void {
    for (let i = this.refunds.length - 1; i >= 0; i--) {
      if (this.refunds[i]?.chargeId === chargeId) this.refunds.splice(i, 1);
    }
    this.succeeded(chargeId, amountPence);
  }

  setStatus(id: string, status: string): void {
    const found = this.refunds.find((r) => r.id === id);
    if (!found) throw new Error(`no refund ${id}`);
    found.status = status;
  }

  async listChargeRefunds(chargeId: string): Promise<ChargeRefund[]> {
    const list = this.refunds.filter((r) => r.chargeId === chargeId).map((r) => ({ ...r }));
    const unfinished = list.filter((r) => r.status === "pending" || r.status === "requires_action");
    this.watched.push(...unfinished);
    if (this.watch && unfinished.length > 0) {
      await this.watch.watch(
        unfinished.map((r) => ({
          stripeRefundId: r.id,
          stripeChargeId: r.chargeId,
          status: r.status,
          amountPence: r.amountPence,
          paymentId: null,
        })),
      );
    }
    return list;
  }

  async retrieveRefund(refundId: string): Promise<ChargeRefund> {
    const found = this.refunds.find((r) => r.id === refundId);
    if (!found) throw new Error(`no refund ${refundId}`);
    return { ...found };
  }

  async retrieveCharge(chargeId: string): Promise<Stripe.Charge> {
    const charge = this.charges.get(chargeId);
    if (!charge) throw new Error(`no charge ${chargeId}`);
    return charge;
  }
}

/** A reader whose every charge has `amountPence` refunded and succeeded. */
export function succeededRefunds(
  amountPence: number,
): Pick<IChargeRefundsReader, "listChargeRefunds"> {
  return {
    listChargeRefunds: async (chargeId) =>
      amountPence > 0
        ? [
            {
              id: "re_succeeded",
              chargeId,
              amountPence,
              status: "succeeded",
              paymentId: null,
              deliveryQuoteId: null,
            },
          ]
        : [],
  };
}
