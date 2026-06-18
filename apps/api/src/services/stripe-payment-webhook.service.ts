import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { gbpAmountToPence } from "../lib/decimal-money.js";
import { tryClaimProcessedStripeEvent } from "../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../middleware/metrics.js";
import { DrizzlePayoutRepository } from "../repositories/drizzle-payout.repository.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPaymentWriteRepository } from "./interfaces/payment-write.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import type { IPayoutRepository } from "./interfaces/payout-repository.js";
import { chargeIdFromPaymentIntent } from "./stripe/stripe-charge-id.js";

type PaymentWebhookResult = {
  processed: boolean;
  action?:
    | "dispute_created"
    | "dispute_funds_withdrawn"
    | "dispute_closed"
    | "refund_received"
    | "payment_intent_succeeded"
    | "payment_intent_succeeded_terminal_blocked"
    | "payment_intent_processing"
    | "payment_intent_partially_funded"
    | "payment_intent_failed"
    | "payment_intent_canceled"
    | "checkout_session_async_payment_failed"
    | "skipped";
  reason?: string;
};

const PAYMENT_WEBHOOK_EVENT_SOURCE = "stripe_payment_webhook";

/** Service for handling Stripe payment-related webhooks. */
export class StripePaymentWebhookService {
  constructor(
    private readonly db: Database,
    private readonly payments: IPaymentWriteRepository,
    private readonly payoutRepository: IPayoutRepository,
    private readonly payoutAdjustments: IPayoutAdjustmentService,
    private readonly paymentCapture: IPaymentCaptureService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async handlePaymentIntentSucceeded(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    const paymentId = paymentIntent.metadata?.paymentId;
    if (!paymentId) {
      return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
    }

    const paymentRow = await this.payments.findById(paymentId);
    if (!paymentRow) {
      recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
      return { processed: false, action: "skipped", reason: "payment_not_found" };
    }

    const expectedPence = gbpAmountToPence(paymentRow.amount);
    if (paymentIntent.amount !== expectedPence) {
      recordMoneyPathEvent("payment_intent_amount_mismatch");
      return { processed: false, action: "skipped", reason: "amount_mismatch" };
    }

    const chargeId = chargeIdFromPaymentIntent(paymentIntent);

    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      if (paymentRow.status === "cancelled" || paymentRow.status === "refunded") {
        recordMoneyPathEvent("stripe_succeeded_for_terminal_payment");
        console.error(
          JSON.stringify({
            msg: "stripe_succeeded_for_terminal_payment",
            paymentId,
            lotId: paymentRow.lotId,
            statusBefore: paymentRow.status,
            stripePaymentIntentId: paymentIntent.id,
            stripeChargeId: chargeId,
          }),
        );
        await this.domainEventPublisher.publish(tx, {
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.capture_blocked_terminal_status",
          payload: {
            paymentId,
            lotId: paymentRow.lotId,
            buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
            statusBefore: paymentRow.status,
            stripePaymentIntentId: paymentIntent.id,
            stripeChargeId: chargeId,
            amountCents: expectedPence,
          },
          actorUserId: null,
          actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
        });
        return {
          processed: true,
          action: "payment_intent_succeeded_terminal_blocked",
          reason: "payment_terminal_status",
        };
      }

      await this.paymentCapture.capture({
        paymentId,
        via: "stripe_checkout_webhook",
        stripeChargeId: chargeId,
        stripePaymentIntentId: paymentIntent.id,
        requireApply: true,
        tx,
      });

      return { processed: true, action: "payment_intent_succeeded" };
    });
  }

  async handlePaymentIntentProcessing(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    const paymentId = paymentIntent.metadata?.paymentId;
    if (!paymentId) {
      return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
    }

    const paymentRow = await this.payments.findById(paymentId);
    if (!paymentRow) {
      recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
      return { processed: false, action: "skipped", reason: "payment_not_found" };
    }

    const expectedPence = gbpAmountToPence(paymentRow.amount);
    if (paymentIntent.amount !== expectedPence) {
      recordMoneyPathEvent("payment_intent_amount_mismatch");
      return { processed: false, action: "skipped", reason: "amount_mismatch" };
    }

    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      await this.payments.applyAuthorizedInTransaction(tx, paymentId);
      recordMoneyPathEvent("payment_intent_processing");
      return { processed: true, action: "payment_intent_processing" };
    });
  }

  async handlePaymentIntentPartiallyFunded(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    const paymentId = paymentIntent.metadata?.paymentId;
    if (!paymentId) {
      return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
    }

    const paymentRow = await this.payments.findById(paymentId);
    if (!paymentRow) {
      recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
      return { processed: false, action: "skipped", reason: "payment_not_found" };
    }

    const expectedPence = gbpAmountToPence(paymentRow.amount);
    if (paymentIntent.amount !== expectedPence) {
      recordMoneyPathEvent("payment_intent_amount_mismatch");
      return { processed: false, action: "skipped", reason: "amount_mismatch" };
    }

    const amountRemainingCents =
      paymentIntent.next_action?.display_bank_transfer_instructions?.amount_remaining ??
      Math.max(0, paymentIntent.amount - (paymentIntent.amount_received ?? 0));

    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      await this.payments.applyAuthorizedInTransaction(tx, paymentId);

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.bank_transfer_partially_funded",
        payload: {
          paymentId,
          lotId: paymentRow.lotId,
          buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
          amountCents: expectedPence,
          amountRemainingCents,
          currency: paymentIntent.currency?.toUpperCase() ?? "GBP",
        },
        actorUserId: null,
        actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
      });

      recordMoneyPathEvent("payment_intent_partially_funded");
      return { processed: true, action: "payment_intent_partially_funded" };
    });
  }

  async handlePaymentIntentFailed(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    const paymentId = paymentIntent.metadata?.paymentId;
    if (!paymentId) {
      return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
    }

    const paymentRow = await this.payments.findById(paymentId);
    if (!paymentRow) {
      recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
      return { processed: false, action: "skipped", reason: "payment_not_found" };
    }

    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.checkout_failed",
        payload: {
          paymentId,
          lotId: paymentRow.lotId,
          buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
          stripePaymentIntentId: paymentIntent.id,
          statusBefore: paymentRow.status,
        },
        actorUserId: null,
        actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
      });

      recordMoneyPathEvent("payment_intent_failed");
      return { processed: true, action: "payment_intent_failed" };
    });
  }

  async handlePaymentIntentCanceled(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    const paymentId = paymentIntent.metadata?.paymentId;
    if (!paymentId) {
      return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
    }

    const paymentRow = await this.payments.findById(paymentId);
    if (!paymentRow) {
      recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
      return { processed: false, action: "skipped", reason: "payment_not_found" };
    }

    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      const cancelled = await this.payments.applyCancelledInTransaction(tx, paymentId);
      if (cancelled) {
        await this.domainEventPublisher.publish(tx, {
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.cancelled",
          payload: {
            lotId: paymentRow.lotId,
            buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
            reason: "stripe_payment_intent_canceled",
          },
          actorUserId: null,
          actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
        });
      }

      recordMoneyPathEvent("payment_intent_canceled");
      return { processed: true, action: "payment_intent_canceled" };
    });
  }

  async handleCheckoutSessionAsyncPaymentFailed(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ): Promise<PaymentWebhookResult> {
    const paymentId = session.metadata?.paymentId;
    if (!paymentId) {
      return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
    }

    const paymentRow = await this.payments.findById(paymentId);
    if (!paymentRow) {
      recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
      return { processed: false, action: "skipped", reason: "payment_not_found" };
    }

    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      const cancelled = await this.payments.applyCancelledInTransaction(tx, paymentId);
      if (cancelled) {
        await this.domainEventPublisher.publish(tx, {
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.cancelled",
          payload: {
            lotId: paymentRow.lotId,
            buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
            reason: "stripe_checkout_async_payment_failed",
          },
          actorUserId: null,
          actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
        });
      }

      recordMoneyPathEvent("checkout_session_async_payment_failed");
      return { processed: true, action: "checkout_session_async_payment_failed" };
    });
  }

  async handleDisputeCreated(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
      if (!chargeId) {
        return { processed: false, reason: "missing_charge_id" };
      }

      const paymentRow = await this.findPaymentRow(tx, { chargeId });
      if (!paymentRow) {
        return { processed: true, action: "skipped", reason: "no_matching_payment" };
      }

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentRow.id,
        eventType: "payment.dispute_opened",
        payload: {
          stripeDisputeId: dispute.id,
          stripeChargeId: chargeId,
          amountCents: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason ?? null,
          sellerLegalEntityId: paymentRow.sellerLegalEntityId,
        },
        actorUserId: null,
        actingLegalEntityId: paymentRow.sellerLegalEntityId,
      });

      return { processed: true, action: "dispute_created" };
    });
  }

  async handleDisputeFundsWithdrawn(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
      if (!chargeId) {
        return { processed: false, reason: "missing_charge_id" };
      }

      const paymentRow = await this.findPaymentRow(tx, { chargeId });
      if (!paymentRow) {
        return { processed: true, action: "skipped", reason: "no_matching_payment" };
      }

      const negativeAmount = (-dispute.amount / 100).toFixed(2);
      await this.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: paymentRow.sellerLegalEntityId,
        paymentId: paymentRow.id,
        amount: negativeAmount,
        kind: "dispute",
        sourceEventId: event.id,
        note: `Dispute funds withdrawn: ${dispute.id}`,
        tx,
      });

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentRow.id,
        eventType: "payment.dispute_funds_withdrawn",
        payload: {
          stripeDisputeId: dispute.id,
          stripeChargeId: chargeId,
          amountCents: dispute.amount,
          currency: dispute.currency,
          sellerLegalEntityId: paymentRow.sellerLegalEntityId,
        },
        actorUserId: null,
        actingLegalEntityId: paymentRow.sellerLegalEntityId,
      });

      return { processed: true, action: "dispute_funds_withdrawn" };
    });
  }

  async handleDisputeClosed(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
      if (!chargeId) {
        return { processed: false, reason: "missing_charge_id" };
      }

      const paymentRow = await this.findPaymentRow(tx, { chargeId });
      if (!paymentRow) {
        return { processed: true, action: "skipped", reason: "no_matching_payment" };
      }

      const outcome =
        dispute.status === "won" ? "won" : dispute.status === "lost" ? "lost" : "closed";

      if (dispute.status === "won") {
        const reversalAmount = (dispute.amount / 100).toFixed(2);
        await this.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
          legalEntityId: paymentRow.sellerLegalEntityId,
          paymentId: paymentRow.id,
          amount: reversalAmount,
          kind: "dispute",
          sourceEventId: `${event.id}:won_reversal`,
          note: `Dispute won — reverse clawback: ${dispute.id}`,
          tx,
        });
      }

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentRow.id,
        eventType: "payment.dispute_closed",
        payload: {
          stripeDisputeId: dispute.id,
          stripeChargeId: chargeId,
          outcome,
          amountCents: dispute.amount,
          currency: dispute.currency,
          sellerLegalEntityId: paymentRow.sellerLegalEntityId,
        },
        actorUserId: null,
        actingLegalEntityId: paymentRow.sellerLegalEntityId,
      });

      return { processed: true, action: "dispute_closed" };
    });
  }

  async handleChargeRefunded(
    event: Stripe.Event,
    charge: Stripe.Charge,
  ): Promise<PaymentWebhookResult> {
    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      const paymentRow = await this.findPaymentRow(tx, {
        chargeId: charge.id,
        paymentIntentId:
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : (charge.payment_intent?.id ?? null),
        paymentId: charge.metadata?.paymentId ?? null,
      });
      if (!paymentRow) {
        return { processed: true, action: "skipped", reason: "no_matching_payment" };
      }

      const payoutRepo = tx === this.db ? this.payoutRepository : new DrizzlePayoutRepository(tx);
      const cumulativeRefundedCents = charge.amount_refunded ?? charge.amount ?? 0;
      const priorRefundedCents = await payoutRepo.sumRefundLineCentsForPayment(paymentRow.id);
      const deltaCents = cumulativeRefundedCents - priorRefundedCents;

      if (deltaCents <= 0) {
        return { processed: true, action: "skipped", reason: "no_new_refund_amount" };
      }

      const isFullRefund = cumulativeRefundedCents >= (charge.amount ?? cumulativeRefundedCents);
      if (isFullRefund) {
        await this.payments.applyRefundedInTransaction(tx, paymentRow.id, null);
      }

      const negativeAmount = (-deltaCents / 100).toFixed(2);
      await this.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: paymentRow.sellerLegalEntityId,
        paymentId: paymentRow.id,
        amount: negativeAmount,
        kind: "refund",
        sourceEventId: event.id,
        note: `Refund: ${charge.id}`,
        tx,
      });

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentRow.id,
        eventType: "payment.refunded",
        payload: {
          stripeChargeId: charge.id,
          amountCents: deltaCents,
          cumulativeRefundedCents,
          currency: charge.currency,
          sellerLegalEntityId: paymentRow.sellerLegalEntityId,
          via: "stripe_webhook",
        },
        actorUserId: null,
        actingLegalEntityId: paymentRow.sellerLegalEntityId,
      });

      return { processed: true, action: "refund_received" };
    });
  }

  private async findPaymentRow(
    db: Database,
    opts: {
      chargeId?: string | null;
      paymentIntentId?: string | null;
      paymentId?: string | null;
    },
  ) {
    if (opts.paymentId) {
      const byId = await this.selectPaymentRow(db, eq(payment.id, opts.paymentId));
      if (byId) return byId;
    }
    if (opts.chargeId) {
      const byCharge = await this.selectPaymentRow(db, eq(payment.stripeChargeId, opts.chargeId));
      if (byCharge) return byCharge;
    }
    if (opts.paymentIntentId) {
      const byPi = await this.selectPaymentRow(
        db,
        eq(payment.stripePaymentIntentId, opts.paymentIntentId),
      );
      if (byPi) return byPi;
    }
    return null;
  }

  private async selectPaymentRow(db: Database, where: ReturnType<typeof eq>) {
    const [row] = await db
      .select({
        id: payment.id,
        sellerLegalEntityId: payment.sellerLegalEntityId,
        status: payment.status,
        amount: payment.amount,
      })
      .from(payment)
      .where(where)
      .limit(1);
    if (!row || !row.sellerLegalEntityId) return null;
    return {
      id: row.id,
      sellerLegalEntityId: row.sellerLegalEntityId,
      status: row.status,
      amount: String(row.amount),
    };
  }
}
