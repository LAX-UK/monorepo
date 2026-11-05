import type { IStalePaymentMaintenance } from "@auction/finance-cron-app";
import {
  CapturingLatePaymentRecorder,
  type IUnappliedMoneyRecorder,
  StalePaymentStore,
  StripeCheckoutCloser,
  expireStalePayments,
} from "@auction/finance-runtime";
import type {
  IPaymentCheckoutSessionStore,
  IPaymentWriteRepository,
  IStalePaymentCanceller,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { IStripeClientFactory } from "../lib/stripe-client.js";
import { recordMoneyPathEvent } from "../middleware/metrics.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IPaymentCaptureService } from "../services/interfaces/payment-capture.js";

/** The API runs the shared expiry job with Stripe and the webhook's own capture path. */
export function createStalePaymentExpiry(input: {
  payments: IPaymentWriteRepository;
  checkoutSessions: IPaymentCheckoutSessionStore;
  canceller: IStalePaymentCanceller;
  /** On a deployment that takes payments, an unreachable Stripe never counts as "no money". */
  stripeExpected: boolean;
  transactionRunner: ITransactionRunner;
  stripeClientFactory: IStripeClientFactory;
  paymentCapture: IPaymentCaptureService;
  unappliedMoney: Pick<IUnappliedMoneyRecorder, "record">;
  events: IDomainEventSink;
}): IStalePaymentMaintenance {
  const deps = {
    payments: new StalePaymentStore(
      input.payments,
      input.checkoutSessions,
      input.canceller,
      input.transactionRunner,
    ),
    provider: new StripeCheckoutCloser(input.stripeClientFactory, {
      stripeExpected: input.stripeExpected,
    }),
    latePayments: new CapturingLatePaymentRecorder(
      input.paymentCapture,
      input.unappliedMoney,
      input.transactionRunner,
    ),
    events: {
      publishCancelled: async (event: {
        paymentId: string;
        lotId: string;
        buyerUserId: string;
        reason: string;
      }) => {
        await input.events.publish({
          aggregateType: "payment",
          aggregateId: event.paymentId,
          eventType: "payment.cancelled",
          payload: { lotId: event.lotId, buyerUserId: event.buyerUserId, reason: event.reason },
          actorUserId: null,
          actingLegalEntityId: null,
        });
      },
    },
    metrics: { record: recordMoneyPathEvent },
  };
  return {
    async expireStalePendingPayments(pendingMaxAgeDays, authorizedMaxAgeDays) {
      const report = await expireStalePayments(
        deps,
        pendingMaxAgeDays,
        authorizedMaxAgeDays ?? pendingMaxAgeDays * 2,
      );
      console.info(JSON.stringify({ msg: "stale_payment_expiry", ...report }));
      return report.expired;
    },
  };
}
