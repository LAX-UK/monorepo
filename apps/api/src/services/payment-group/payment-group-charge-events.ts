import type { Database } from "@auction/db";
import { attributeGroupRefunds } from "@auction/domain";
import type {
  IPaymentGroupRepository,
  IPaymentLifecycleRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { PaymentWebhookResult } from "../stripe-webhook/payment-webhook-types.js";
import type { IPaymentGroupGateway } from "./payment-group-ports.js";
import type { IProviderEventClaim } from "./payment-group-settlement.service.js";

export type PaymentGroupChargeEventsDeps = {
  transactionRunner: ITransactionRunner;
  groups: Pick<IPaymentGroupRepository, "findByStripeRefs" | "listMembers">;
  gateway: Pick<IPaymentGroupGateway, "listChargeRefunds">;
  payments: Pick<IPaymentLifecycleRepository, "applyRefundedInTransaction">;
  payoutAdjustments: Pick<IPayoutAdjustmentService, "addPaymentLineToOpenPayoutOrCreateClawback">;
  /** What the seller's ledger already holds as refunded for the payment, in pence. */
  refundedCentsSoFar: (tx: Database, paymentId: string) => Promise<number>;
  events: IDomainEventSink;
  claims: IProviderEventClaim;
};

const DUPLICATE: PaymentWebhookResult = {
  processed: false,
  action: "skipped",
  reason: "duplicate_event",
};

const paymentIntentIdOf = (pi: string | { id: string } | null | undefined) =>
  typeof pi === "string" ? pi : (pi?.id ?? null);

/**
 * Refunds on a charge that settled several invoices. Answers `null` when the charge is not a
 * group's, so the single-invoice handler takes it unchanged.
 *
 * Refunds are made per invoice and name it, so each invoice's ledger moves by its own refunds
 * only; a refund naming no invoice is reported, never spread. (Disputes on any charge are
 * recorded as dispute cases; one on a group's charge waits for the finance team to allocate it.)
 */
export class PaymentGroupChargeEvents {
  constructor(private readonly deps: PaymentGroupChargeEventsDeps) {}

  async chargeRefunded(
    event: Stripe.Event,
    charge: Stripe.Charge,
  ): Promise<PaymentWebhookResult | null> {
    const group = await this.deps.groups.findByStripeRefs({
      chargeId: charge.id,
      paymentIntentId: paymentIntentIdOf(charge.payment_intent),
    });
    if (!group) return null;
    const [members, refunds] = await Promise.all([
      this.deps.groups.listMembers(group.id),
      this.deps.gateway.listChargeRefunds(charge.id),
    ]);
    const attribution = attributeGroupRefunds(
      members.map((m) => m.paymentId),
      refunds,
    );

    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, event.id))) return DUPLICATE;
      let applied = 0;
      for (const member of members) {
        const refundedPence = attribution.refundedPenceByPayment.get(member.paymentId) ?? 0;
        const deltaCents =
          refundedPence - (await this.deps.refundedCentsSoFar(tx, member.paymentId));
        if (deltaCents <= 0) continue;
        applied += 1;
        if (refundedPence >= gbpAmountToPence(member.amount)) {
          await this.deps.payments.applyRefundedInTransaction(tx, member.paymentId, null);
        }
        await this.deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
          legalEntityId: member.sellerLegalEntityId,
          paymentId: member.paymentId,
          amount: (-deltaCents / 100).toFixed(2),
          kind: "refund",
          sourceEventId: `${event.id}:${member.paymentId}`,
          note: `Refund: ${charge.id}`,
          tx,
        });
        await this.deps.events.withTx(tx).publish({
          aggregateType: "payment",
          aggregateId: member.paymentId,
          eventType: "payment.refunded",
          payload: {
            stripeChargeId: charge.id,
            amountCents: deltaCents,
            cumulativeRefundedCents: refundedPence,
            currency: charge.currency,
            sellerLegalEntityId: member.sellerLegalEntityId,
            via: "stripe_webhook",
          },
          actorUserId: null,
          actingLegalEntityId: member.sellerLegalEntityId,
        });
      }
      if (attribution.unattributedPence > 0) {
        recordMoneyPathEvent("payment_group_refund_unattributed");
        await this.deps.events.withTx(tx).publish({
          aggregateType: "payment_group",
          aggregateId: group.id,
          eventType: "payment_group.refund_unattributed",
          payload: {
            paymentGroupId: group.id,
            stripeChargeId: charge.id,
            amountCents: attribution.unattributedPence,
            currency: charge.currency,
          },
          actorUserId: null,
          actingLegalEntityId: group.buyerLegalEntityId,
        });
      }
      return applied > 0
        ? { processed: true, action: "refund_received" }
        : { processed: true, action: "skipped", reason: "no_new_refund_amount" };
    });
  }
}
