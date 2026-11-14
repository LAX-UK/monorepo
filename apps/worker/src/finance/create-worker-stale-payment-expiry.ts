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
  paymentsAreLive,
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

type PaymentIdentityEnv = Pick<
  WorkerEnv,
  "STRIPE_SECRET_KEY" | "NODE_ENV" | "APP_ENV" | "VERIFF_API_KEY"
>;

/**
 * The identity check the worker's account rule reads. It is the stored KYC status (a database
 * read, the same one the API gate uses), so the worker needs no identity provider of its own:
 * wherever payments are live it reads it, as it does where Veriff is configured. Only where
 * neither holds (local and test runs without Veriff) is there no identity check, as in the API.
 */
export function workerPaymentIdentityReader(
  db: Database,
  env: PaymentIdentityEnv,
): DrizzleBidActorEligibilityReader | null {
  return paymentsAreLive(env) || env.VERIFF_API_KEY
    ? new DrizzleBidActorEligibilityReader(db)
    : null;
}

/**
 * The worker runs the shared expiry job with the same Stripe checks as the API. It cannot run the
 * capture (receipt, fulfilment, books), so money Stripe shows as paid becomes a finance task and
 * the invoice stays open.
 */
export function createWorkerStalePaymentExpiry(input: {
  db: Database;
  env: PaymentIdentityEnv;
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
  // The same account rule as the API, reading the same stored KYC status: personal payers who
  // are verified may pay, and the rest are held, wherever payments are live.
  const heldCheckouts = new HeldInvoiceCheckouts({
    payments,
    provider,
    eligibility: createPaymentEligibilityGate({
      accounts: new DrizzleLegalEntityRepository(
        new DrizzleLegalEntityReader(db),
        new DrizzleLegalEntityMembershipReader(db),
      ),
      identity: workerPaymentIdentityReader(db, env),
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
