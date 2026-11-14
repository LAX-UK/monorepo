import type { Database } from "@auction/db";
import {
  FinanceTaskLatePaymentRecorder,
  HeldInvoiceCheckouts,
  StalePaymentStore,
  StripeCheckoutCloser,
  StripeClientFactory,
  UnappliedMoneyRecorder,
  createPaymentEligibilityGate,
  expireStalePayments,
} from "@auction/finance-runtime";
import {
  DrizzleBidActorEligibilityReader,
  DrizzleLegalEntityMembershipReader,
  DrizzleLegalEntityReader,
  DrizzleLegalEntityRepository,
  DrizzlePaymentCheckoutSessionRepository,
  DrizzlePaymentRepository,
  DrizzleStalePaymentCanceller,
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
  env: Pick<WorkerEnv, "STRIPE_SECRET_KEY" | "NODE_ENV" | "APP_ENV" | "VERIFF_API_KEY">;
  domainEventSink: IWorkerDomainEventSink;
}) {
  const { db, env, domainEventSink } = input;
  const runner = new DrizzleTransactionRunner(db);
  const canceller = new DrizzleStalePaymentCanceller(db);
  const payments = new StalePaymentStore(
    new DrizzlePaymentRepository(db),
    new DrizzlePaymentCheckoutSessionRepository(db),
    canceller,
    runner,
  );
  const provider = new StripeCheckoutCloser(new StripeClientFactory(env.STRIPE_SECRET_KEY), {
    stripeExpected: env.NODE_ENV === "production",
  });
  // The same account rule as the API: personal payers verified where Veriff can verify them,
  // and held wherever payments are live when it cannot.
  const heldCheckouts = new HeldInvoiceCheckouts({
    payments,
    provider,
    eligibility: createPaymentEligibilityGate({
      accounts: new DrizzleLegalEntityRepository(
        new DrizzleLegalEntityReader(db),
        new DrizzleLegalEntityMembershipReader(db),
      ),
      identity: env.VERIFF_API_KEY ? new DrizzleBidActorEligibilityReader(db) : null,
      env,
    }),
    listUnpaidWithCheckout: (limit) => canceller.listUnpaidWithCheckout(limit),
    listOpenGroupsWithCheckout: (limit) => canceller.listOpenGroupsWithCheckout(limit),
  });
  const deps = {
    payments,
    provider,
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
    // Idempotent: closes the checkouts of invoices held at deploy, and of any held since.
    const held = await heldCheckouts.sweep();
    console.info(JSON.stringify({ msg: "held_invoice_checkouts_closed", ...held }));
    return report.expired;
  };
}
