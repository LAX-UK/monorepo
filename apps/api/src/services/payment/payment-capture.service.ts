import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence";
import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence";
import type { ILotFulfilmentPaymentHook } from "@auction/persistence";
import type { IPaymentWriteRepository, PaymentRecord } from "@auction/persistence";
import type { ILotRepository, IUserRepository } from "@auction/persistence";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { PaymentCaptureNotAppliedError } from "../../lib/errors.js";
import { buildMarketingEventConsent, nowUnixSeconds } from "../../lib/marketing-event-factory.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IXeroPaymentRecorder } from "../accounting/xero-payment-recorder.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import type {
  CapturePaymentInput,
  CapturePaymentResult,
  IPaymentCaptureService,
} from "../interfaces/payment-capture.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { NotificationFactory } from "../notification.factory.js";
import { chargeIdFromPaymentIntent } from "../stripe/stripe-charge-id.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import { dispatchPaymentReceived } from "./dispatch-payment-received.js";

const XERO_CAPTURE_VIAS: CapturePaymentInput["via"][] = [
  "stripe_checkout_webhook",
  "stripe_payment_intent",
  "admin_manual",
];

export class PaymentCaptureService implements IPaymentCaptureService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly payments: IPaymentWriteRepository,
    private readonly lots: ILotRepository,
    private readonly users: IUserRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly notificationFactory: NotificationFactory,
    private readonly legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null,
    private readonly lotFulfilmentHooks: ILotFulfilmentPaymentHook | null,
    private readonly marketingEvents: IMarketingEventService | null,
    private readonly xeroPaymentRecorder: IXeroPaymentRecorder | null = null,
    private readonly stripePayments: IStripePaymentGateway | null = null,
  ) {}

  async capture(input: CapturePaymentInput): Promise<CapturePaymentResult> {
    const p = await this.payments.findById(input.paymentId);
    if (!p || p.status === "captured" || p.status === "refunded" || p.status === "cancelled") {
      return { captured: false };
    }

    const buyerId = p.paidByUserId ?? p.buyerId ?? null;
    const buyer = buyerId ? await this.users.findById(buyerId) : null;
    const captureFromManualReview = p.status === "requires_manual_review";

    const resolvedChargeId = await this.resolveStripeChargeId(p, input);

    const purchaseEvent =
      buyerId && this.marketingEvents
        ? {
            name: "Purchase" as const,
            eventId: `payment_captured_${input.paymentId}`,
            eventTime: nowUnixSeconds(),
            actionSource: "system_generated" as const,
            userIdOrAnon: { kind: "user" as const, userId: buyerId },
            consent: buildMarketingEventConsent(false, false, "legitimate_interest"),
            customData: {
              lotId: p.lotId,
              paymentId: p.id,
              valueMinor: gbpAmountToPence(p.amount),
              currencyCode: "GBP",
            },
          }
        : null;

    let captured = false;
    const apply = async (tx: Database) => {
      const captureOpts: { stripeChargeId?: string | null } = {};
      if (resolvedChargeId) {
        captureOpts.stripeChargeId = resolvedChargeId;
      }
      captured = await this.payments.applyCapturedInTransaction(tx, input.paymentId, captureOpts);
      if (!captured) return;
      await this.domainEventPublisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: input.paymentId,
        eventType: "payment.captured",
        payload: {
          paymentId: p.id,
          lotId: p.lotId,
          userId: buyerId,
          amountCents: gbpAmountToPence(p.amount),
          capturedAt: new Date().toISOString(),
          stripeIntentId: input.stripePaymentIntentId ?? p.stripePaymentIntentId,
          stripeChargeId: resolvedChargeId ?? null,
          via: input.via,
          buyerName: buyer?.name ?? null,
          buyerEmail: buyer?.email ?? null,
        },
        actorUserId: input.actorUserId ?? null,
        actingLegalEntityId: p.sellerLegalEntityId ?? null,
      });
      if (purchaseEvent && this.marketingEvents) {
        await this.marketingEvents.stage(purchaseEvent, tx);
      }
    };

    if (input.tx) {
      await apply(input.tx);
    } else {
      await this.transactionRunner.runInTransaction(apply);
    }

    if (!captured) {
      if (input.requireApply) {
        const current = await this.payments.findById(input.paymentId);
        if (current?.status === "captured") {
          return { captured: false };
        }
        throw new PaymentCaptureNotAppliedError(input.paymentId, current?.status ?? "unknown");
      }
      return { captured: false };
    }

    const after = (await this.payments.findById(input.paymentId)) ?? p;
    await dispatchPaymentReceived({
      payment: after,
      lots: this.lots,
      lotFulfilmentHooks: this.lotFulfilmentHooks,
      notificationDispatcher: this.notificationDispatcher,
      notificationFactory: this.notificationFactory,
      legalEntityNotificationRecipients: this.legalEntityNotificationRecipients,
    });

    if (purchaseEvent && this.marketingEvents) {
      await this.marketingEvents.enqueue(purchaseEvent);
    }

    recordMoneyPathEvent(`payment_capture_via_${input.via}`);
    if (captureFromManualReview) {
      recordMoneyPathEvent("payment_capture_from_manual_review_reconciliation");
    }

    if (XERO_CAPTURE_VIAS.includes(input.via) && this.xeroPaymentRecorder) {
      const xeroResult = await this.xeroPaymentRecorder.recordStripeCapture(
        input.paymentId,
        after.amount,
      );
      if (!xeroResult.ok) {
        recordMoneyPathEvent("xero_payment_record_failed");
      }
    }

    return { captured: true };
  }

  private async resolveStripeChargeId(
    payment: PaymentRecord,
    input: CapturePaymentInput,
  ): Promise<string | null> {
    const fromInput = input.stripeChargeId ?? payment.stripeChargeId ?? null;
    if (fromInput) return fromInput;

    const piId = input.stripePaymentIntentId ?? payment.stripePaymentIntentId;
    if (!piId || !this.stripePayments?.isConfigured()) {
      return null;
    }

    try {
      const pi = await this.stripePayments.retrievePaymentIntent(piId);
      const fromPi = chargeIdFromPaymentIntent(pi);
      if (fromPi) return fromPi;
    } catch {
      // Fall through to charge search.
    }

    return this.stripePayments.findChargeIdForPayment(payment.id);
  }
}
