import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type {
  DrizzleWebhookEventRepository,
  IWebhookEventRepository,
} from "../repositories/drizzle-webhook-event.repository.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IPayoutRepository } from "./interfaces/payout-repository.js";

type PaymentWebhookResult = {
  processed: boolean;
  action?: "dispute_created" | "dispute_closed" | "refund_received" | "skipped";
  reason?: string;
};

/** Service for handling Stripe payment-related webhooks.
 * Processes: charge.dispute.created, charge.dispute.funds_withdrawn,
 * charge.dispute.closed, charge.refunded.
 */
export class StripePaymentWebhookService {
  constructor(
    private readonly db: Database,
    private readonly webhookEventRepository: IWebhookEventRepository,
    private readonly payoutRepository: IPayoutRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async handleDisputeCreated(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    const eventKey = `stripe:${event.id}`;
    const { claimed } = await this.webhookEventRepository.tryClaimEvent({
      source: "stripe",
      eventKey,
      payload: { eventType: event.type, disputeId: dispute.id },
    });
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) {
      await this.webhookEventRepository.markFailed(eventKey, "missing_charge_id");
      return { processed: false, reason: "missing_charge_id" };
    }

    const paymentRow = await this.findPaymentByStripeChargeId(chargeId);
    if (!paymentRow) {
      await this.webhookEventRepository.markProcessed(eventKey);
      return { processed: true, action: "skipped", reason: "no_matching_payment" };
    }

    await this.domainEventPublisher.publish(this.db, {
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

    await this.webhookEventRepository.markProcessed(eventKey);
    return { processed: true, action: "dispute_created" };
  }

  async handleDisputeClosed(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    const eventKey = `stripe:${event.id}`;
    const { claimed } = await this.webhookEventRepository.tryClaimEvent({
      source: "stripe",
      eventKey,
      payload: { eventType: event.type, disputeId: dispute.id, status: dispute.status },
    });
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) {
      await this.webhookEventRepository.markFailed(eventKey, "missing_charge_id");
      return { processed: false, reason: "missing_charge_id" };
    }

    const paymentRow = await this.findPaymentByStripeChargeId(chargeId);
    if (!paymentRow) {
      await this.webhookEventRepository.markProcessed(eventKey);
      return { processed: true, action: "skipped", reason: "no_matching_payment" };
    }

    const outcome = dispute.status === "won" ? "won" : "lost";

    if (outcome === "lost") {
      const openPayout = await this.payoutRepository.findOpenPayoutForEntity(
        paymentRow.sellerLegalEntityId,
      );
      const negativeAmount = (-dispute.amount / 100).toFixed(2);

      if (openPayout) {
        await this.payoutRepository.insertLine({
          payoutId: openPayout.id,
          paymentId: paymentRow.id,
          amount: negativeAmount,
          kind: "dispute",
          createdByUserId: null,
          note: `Dispute lost: ${dispute.id}`,
          sourceEventId: event.id,
        });
      } else {
        const now = new Date();
        const created = await this.payoutRepository.create({
          legalEntityId: paymentRow.sellerLegalEntityId,
          periodStart: new Date(now.getTime() - 1),
          periodEnd: now,
          grossAmount: negativeAmount,
          platformFee: "0.00",
          stripeFee: "0.00",
          netAmount: negativeAmount,
          currency: "GBP",
        });
        await this.payoutRepository.insertLine({
          payoutId: created.id,
          paymentId: paymentRow.id,
          amount: negativeAmount,
          kind: "dispute",
          createdByUserId: null,
          note: `Dispute lost after paid payout: ${dispute.id}`,
          sourceEventId: event.id,
        });
      }
    }

    await this.domainEventPublisher.publish(this.db, {
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

    await this.webhookEventRepository.markProcessed(eventKey);
    return { processed: true, action: "dispute_closed" };
  }

  async handleChargeRefunded(
    event: Stripe.Event,
    charge: Stripe.Charge,
  ): Promise<PaymentWebhookResult> {
    const eventKey = `stripe:${event.id}`;
    const { claimed } = await this.webhookEventRepository.tryClaimEvent({
      source: "stripe",
      eventKey,
      payload: { eventType: event.type, chargeId: charge.id },
    });
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    const paymentRow = await this.findPaymentByStripeChargeId(charge.id);
    if (!paymentRow) {
      await this.webhookEventRepository.markProcessed(eventKey);
      return { processed: true, action: "skipped", reason: "no_matching_payment" };
    }

    await this.db.update(payment).set({ status: "refunded" }).where(eq(payment.id, paymentRow.id));

    const refundedAmount = charge.amount_refunded ?? charge.amount;
    const openPayout = await this.payoutRepository.findOpenPayoutForEntity(
      paymentRow.sellerLegalEntityId,
    );

    if (openPayout) {
      const negativeAmount = (-refundedAmount / 100).toFixed(2);
      await this.payoutRepository.insertLine({
        payoutId: openPayout.id,
        paymentId: paymentRow.id,
        amount: negativeAmount,
        kind: "refund",
        createdByUserId: null,
        note: `Refund: ${charge.id}`,
        sourceEventId: event.id,
      });
    }

    await this.domainEventPublisher.publish(this.db, {
      aggregateType: "payment",
      aggregateId: paymentRow.id,
      eventType: "payment.refunded",
      payload: {
        stripeChargeId: charge.id,
        amountCents: refundedAmount,
        currency: charge.currency,
        sellerLegalEntityId: paymentRow.sellerLegalEntityId,
        via: "stripe_webhook",
      },
      actorUserId: null,
      actingLegalEntityId: paymentRow.sellerLegalEntityId,
    });

    await this.webhookEventRepository.markProcessed(eventKey);
    return { processed: true, action: "refund_received" };
  }

  private async findPaymentByStripeChargeId(chargeId: string) {
    const [row] = await this.db
      .select({
        id: payment.id,
        sellerLegalEntityId: payment.sellerLegalEntityId,
        status: payment.status,
        amount: payment.amount,
      })
      .from(payment)
      .where(eq(payment.stripeChargeId, chargeId))
      .limit(1);
    return row ?? null;
  }
}
