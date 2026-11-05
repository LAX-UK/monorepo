import type { Database } from "@auction/db";
import {
  FinanceTaskLatePaymentRecorder,
  StalePaymentStore,
  StripeCheckoutCloser,
  StripeClientFactory,
  UnappliedMoneyRecorder,
  expireStalePayments,
} from "@auction/finance-runtime";
import {
  DrizzlePaymentCheckoutSessionRepository,
  DrizzlePaymentRepository,
  DrizzleTransactionRunner,
  DrizzleUnappliedMoneyReader,
} from "@auction/persistence/repositories";
import type { WorkerEnv } from "../env.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";

/**
 * The worker runs the shared expiry job with the same Stripe checks as the API. It cannot run the
 * capture (receipt, fulfilment, books), so money Stripe shows as paid becomes a finance task and
 * the invoice stays open.
 */
export function createWorkerStalePaymentExpiry(input: {
  db: Database;
  env: Pick<WorkerEnv, "STRIPE_SECRET_KEY">;
  domainEventSink: IWorkerDomainEventSink;
}) {
  const { db, env, domainEventSink } = input;
  const runner = new DrizzleTransactionRunner(db);
  const deps = {
    payments: new StalePaymentStore(
      new DrizzlePaymentRepository(db),
      new DrizzlePaymentCheckoutSessionRepository(db),
      runner,
    ),
    provider: new StripeCheckoutCloser(new StripeClientFactory(env.STRIPE_SECRET_KEY)),
    latePayments: new FinanceTaskLatePaymentRecorder(
      new UnappliedMoneyRecorder(new DrizzleUnappliedMoneyReader(db), domainEventSink),
      runner,
    ),
    events: {
      publishCancelled: async (event: {
        paymentId: string;
        lotId: string;
        buyerUserId: string;
        reason: string;
      }) => {
        await domainEventSink.publish({
          aggregateType: "payment",
          aggregateId: event.paymentId,
          eventType: "payment.cancelled",
          payload: { lotId: event.lotId, buyerUserId: event.buyerUserId, reason: event.reason },
          actorUserId: null,
          actingLegalEntityId: null,
          producer: "apps/worker",
        });
      },
    },
  };
  return async (pendingMaxAgeDays: number, authorizedMaxAgeDays: number): Promise<number> => {
    const report = await expireStalePayments(deps, pendingMaxAgeDays, authorizedMaxAgeDays);
    console.info(JSON.stringify({ msg: "stale_payment_expiry", ...report }));
    return report.expired;
  };
}
