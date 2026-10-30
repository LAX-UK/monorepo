import type { Database } from "@auction/db";
import { allocateGroupDispute, attributeGroupRefunds } from "@auction/domain";
import type {
  IPaymentGroupRepository,
  IPaymentLifecycleRepository,
  ITransactionRunner,
  PaymentGroupMember,
  PaymentGroupRecord,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { PaymentWebhookResult } from "../stripe-webhook/payment-webhook-types.js";
import type { IPaymentGroupGateway } from "./payment-group-ports.js";
import type { IProviderEventClaim } from "./payment-group-settlement.service.js";

export type DisputeStage = "created" | "funds_withdrawn" | "closed";

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

const DISPUTE_ACTION: Record<DisputeStage, NonNullable<PaymentWebhookResult["action"]>> = {
  created: "dispute_created",
  funds_withdrawn: "dispute_funds_withdrawn",
  closed: "dispute_closed",
};

const paymentIntentIdOf = (pi: string | { id: string } | null | undefined) =>
  typeof pi === "string" ? pi : (pi?.id ?? null);

/**
 * Refunds and disputes on a charge that settled several invoices. Each answers `null` when the
 * charge is not a group's, so the single-invoice handlers take it unchanged.
 *
 * Refunds are made per invoice and name it, so each invoice's ledger moves by its own refunds
 * only; a refund naming no invoice is reported, never spread. A dispute of the whole charge falls
 * on every invoice in full; a dispute of part of it is handed to the finance team to allocate.
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

  async dispute(
    stage: DisputeStage,
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult | null> {
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) return null;
    const group = await this.deps.groups.findByStripeRefs({
      chargeId,
      paymentIntentId: paymentIntentIdOf(dispute.payment_intent),
    });
    if (!group) return null;
    const members = await this.deps.groups.listMembers(group.id);
    const allocation = allocateGroupDispute(
      dispute.amount,
      members.map((m) => ({ paymentId: m.paymentId, amountPence: gbpAmountToPence(m.amount) })),
    );

    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, event.id))) return DUPLICATE;
      if (!allocation) {
        await this.needsAllocation(tx, group, stage, chargeId, dispute);
        return { processed: true, action: DISPUTE_ACTION[stage], reason: "needs_allocation" };
      }
      const byPayment = new Map(members.map((m) => [m.paymentId, m]));
      for (const share of allocation) {
        const member = byPayment.get(share.paymentId) as PaymentGroupMember;
        await this.applyDisputeShare(
          tx,
          stage,
          event,
          dispute,
          chargeId,
          member,
          share.amountPence,
        );
      }
      return { processed: true, action: DISPUTE_ACTION[stage] };
    });
  }

  private async applyDisputeShare(
    tx: Database,
    stage: DisputeStage,
    event: Stripe.Event,
    dispute: Stripe.Dispute,
    chargeId: string,
    member: PaymentGroupMember,
    amountPence: number,
  ): Promise<void> {
    const base = {
      stripeDisputeId: dispute.id,
      stripeChargeId: chargeId,
      amountCents: amountPence,
      currency: dispute.currency,
      sellerLegalEntityId: member.sellerLegalEntityId,
    };
    const publish = (eventType: string, payload: Record<string, unknown>) =>
      this.deps.events.withTx(tx).publish({
        aggregateType: "payment",
        aggregateId: member.paymentId,
        eventType,
        payload,
        actorUserId: null,
        actingLegalEntityId: member.sellerLegalEntityId,
      });

    if (stage === "created") {
      await publish("payment.dispute_opened", { ...base, reason: dispute.reason ?? null });
      return;
    }
    if (stage === "funds_withdrawn") {
      await this.deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: member.sellerLegalEntityId,
        paymentId: member.paymentId,
        amount: (-amountPence / 100).toFixed(2),
        kind: "dispute",
        sourceEventId: `${event.id}:${member.paymentId}`,
        note: `Dispute funds withdrawn: ${dispute.id}`,
        tx,
      });
      await publish("payment.dispute_funds_withdrawn", base);
      return;
    }
    if (dispute.status === "won") {
      await this.deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: member.sellerLegalEntityId,
        paymentId: member.paymentId,
        amount: (amountPence / 100).toFixed(2),
        kind: "dispute",
        sourceEventId: `${event.id}:${member.paymentId}:won_reversal`,
        note: `Dispute won — reverse clawback: ${dispute.id}`,
        tx,
      });
    }
    const outcome =
      dispute.status === "won" ? "won" : dispute.status === "lost" ? "lost" : "closed";
    await publish("payment.dispute_closed", { ...base, outcome });
  }

  private async needsAllocation(
    tx: Database,
    group: PaymentGroupRecord,
    stage: DisputeStage,
    chargeId: string,
    dispute: Stripe.Dispute,
  ): Promise<void> {
    recordMoneyPathEvent(`payment_group_dispute_needs_allocation_${stage}`);
    await this.deps.events.withTx(tx).publish({
      aggregateType: "payment_group",
      aggregateId: group.id,
      eventType: "payment_group.dispute_needs_allocation",
      payload: {
        paymentGroupId: group.id,
        stage,
        stripeDisputeId: dispute.id,
        stripeChargeId: chargeId,
        amountCents: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason ?? null,
      },
      actorUserId: null,
      actingLegalEntityId: group.buyerLegalEntityId,
    });
  }
}
