import type { Database } from "@auction/db";
import { attributeGroupRefunds } from "@auction/domain";
import type {
  IPaymentGroupRepository,
  IPaymentLifecycleRepository,
  IPaymentRefundLedger,
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
  groups: Pick<IPaymentGroupRepository, "findByStripeRefs" | "lockInTransaction">;
  gateway: Pick<IPaymentGroupGateway, "listChargeRefunds">;
  payments: Pick<IPaymentLifecycleRepository, "applyRefundedInTransaction">;
  payoutAdjustments: Pick<IPayoutAdjustmentService, "addPaymentLineToOpenPayoutOrCreateClawback">;
  /** What the buyer was refunded for each invoice so far, and where each new refund is kept. */
  paymentRefunds: IPaymentRefundLedger;
  /** What the seller's ledger already holds as refunded for the payment, in pence. */
  sellerRefundedCents: (tx: Database, paymentId: string) => Promise<number>;
  events: IDomainEventSink;
  claims: IProviderEventClaim;
};

const DUPLICATE: PaymentWebhookResult = {
  processed: false,
  action: "skipped",
  reason: "duplicate_event",
};

const GROUP_NOT_FOUND: PaymentWebhookResult = {
  processed: false,
  action: "skipped",
  reason: "payment_group_not_found",
};

const paymentIntentIdOf = (pi: string | { id: string } | null | undefined) =>
  typeof pi === "string" ? pi : (pi?.id ?? null);

/**
 * Refunds on a charge that settled several invoices. Answers `null` when the charge is not a
 * group's, so the single-invoice handler takes it unchanged.
 *
 * Refunds are made per invoice and name it, so each invoice's record moves by its own refunds
 * only; a refund naming no invoice is reported, never spread. The buyer's record keeps what was
 * refunded as it is, even above the invoice; the seller's ledger is never reversed by more than
 * the invoice paid, so the excess is left for finance to see on the invoice. (Disputes on any charge are
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
    // Stripe is asked before the transaction, so no lock is held across the network call. What
    // is measured against it (what is already recorded) is read under the lock below.
    const refunds = await this.deps.gateway.listChargeRefunds(charge.id);

    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, event.id))) return DUPLICATE;
      // The group, then its invoices in id order: a staff refund of one invoice waits here, and
      // every sum below is taken while no other refund of these invoices can be recorded.
      const locked = await this.deps.groups.lockInTransaction(tx, group.id);
      if (!locked) return GROUP_NOT_FOUND;
      const members = [...locked.members].sort((a, b) => a.paymentId.localeCompare(b.paymentId));
      const attribution = attributeGroupRefunds(
        members.map((m) => ({ paymentId: m.paymentId })),
        refunds,
      );
      let applied = 0;
      for (const member of members) {
        const refundedPence = attribution.refundedPenceByPayment.get(member.paymentId) ?? 0;
        const invoicePence = gbpAmountToPence(member.amount);
        // Already held through the group; this also brings the record up to the payout lines.
        await this.deps.paymentRefunds.lockPaymentInTransaction(tx, member.paymentId);
        // The buyer's record and the seller's ledger are measured separately: a refund the
        // previous release processed has a payout line but no buyer row until the backfill is
        // run again, and the seller must not be charged back for it twice.
        const { pence: recordedBuyerPence } =
          await this.deps.paymentRefunds.sumRefundedPenceInTransaction(tx, member.paymentId);
        const recordedSellerPence = await this.deps.sellerRefundedCents(tx, member.paymentId);
        const buyerDeltaCents = refundedPence - recordedBuyerPence;
        const sellerDeltaCents =
          Math.min(refundedPence, invoicePence) - Math.min(recordedSellerPence, invoicePence);
        if (buyerDeltaCents <= 0 && sellerDeltaCents <= 0) continue;
        if (refundedPence >= invoicePence) {
          await this.deps.payments.applyRefundedInTransaction(tx, member.paymentId, null);
        }
        const sourceEventId = `${event.id}:${member.paymentId}`;
        if (buyerDeltaCents > 0) {
          await this.deps.paymentRefunds.recordInTransaction(tx, {
            paymentId: member.paymentId,
            idempotencyKey: sourceEventId,
            amountPence: buyerDeltaCents,
            currency: charge.currency,
            source: "group_webhook",
          });
        }
        // Only the buyer's record was behind: the seller was charged back, and the refund
        // announced, when the previous release handled it.
        if (sellerDeltaCents <= 0) continue;
        applied += 1;
        await this.deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
          legalEntityId: member.sellerLegalEntityId,
          paymentId: member.paymentId,
          amount: (-sellerDeltaCents / 100).toFixed(2),
          kind: "refund",
          sourceEventId,
          note: `Refund: ${charge.id}`,
          tx,
        });
        await this.deps.events.withTx(tx).publish({
          aggregateType: "payment",
          aggregateId: member.paymentId,
          eventType: "payment.refunded",
          payload: {
            stripeChargeId: charge.id,
            amountCents: sellerDeltaCents,
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
