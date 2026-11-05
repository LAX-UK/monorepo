import type { Database } from "@auction/db";
import { parsePaymentTierLimits } from "@auction/domain";
import {
  AmlSettlementCompliancePolicy,
  InvoiceRecipients,
  LotFulfilmentPaymentSync,
  LotInvoiceInitiationService,
  PaymentTierPolicy,
  PlatformFeePolicy,
  SourceOfFundsGateService,
} from "@auction/finance-runtime";
import type { XeroAccountingStack } from "@auction/finance-runtime";
import {
  DrizzleAmlHoldStore,
  DrizzleLegalEntityMembershipReader,
  DrizzleLegalEntityNotificationRecipientRepository,
  DrizzleLegalEntityReader,
  DrizzleLegalEntityRepository,
  DrizzleLotFulfilmentRepository,
  DrizzleLotRepository,
  DrizzleNotificationOutboxRepository,
  DrizzlePaymentRepository,
  DrizzleSaleRepository,
  DrizzleSourceOfFundsRepository,
  DrizzleTransactionRunner,
  DrizzleUserRepository,
} from "@auction/persistence/repositories";
import type { WorkerEnv } from "../env.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import {
  WorkerNotificationFactory,
  notificationRowToPayload,
} from "../lifecycle/worker-notification-factory.js";

/** The same hold the API applies: an AML hold, or source of funds needed for this amount. */
function createWorkerSettlementCompliance(
  db: Database,
  env: WorkerEnv,
  domainEventSink: IWorkerDomainEventSink,
) {
  return new AmlSettlementCompliancePolicy(
    new DrizzleAmlHoldStore(db),
    new SourceOfFundsGateService(
      new DrizzleSourceOfFundsRepository(db),
      {
        thresholdAmount: env.SOF_THRESHOLD_AMOUNT,
        currency: env.SOF_THRESHOLD_CURRENCY,
        approvalValidityDays: env.SOF_APPROVAL_VALIDITY_DAYS,
      },
      new DrizzleTransactionRunner(db),
      domainEventSink,
    ),
  );
}

export function createWorkerLotInvoiceInitiationService(input: {
  db: Database;
  env: WorkerEnv;
  domainEventSink: IWorkerDomainEventSink;
  xeroStack: Pick<XeroAccountingStack, "accountingProvider">;
}) {
  const { db, env, domainEventSink, xeroStack } = input;
  const lots = new DrizzleLotRepository(db);
  const sales = new DrizzleSaleRepository(db);
  const payments = new DrizzlePaymentRepository(db);
  const legalEntities = new DrizzleLegalEntityRepository(
    new DrizzleLegalEntityReader(db),
    new DrizzleLegalEntityMembershipReader(db),
  );
  const outbox = new DrizzleNotificationOutboxRepository(db);
  const notificationFactory = new WorkerNotificationFactory();

  const tierLimits = parsePaymentTierLimits({
    STRIPE_CARD_CHECKOUT_MAX: env.STRIPE_CARD_CHECKOUT_MAX,
    STRIPE_MANUAL_REVIEW_MIN: env.STRIPE_MANUAL_REVIEW_MIN,
    STRIPE_ABSOLUTE_MAX: env.STRIPE_ABSOLUTE_MAX,
  });

  return new LotInvoiceInitiationService(
    lots,
    sales,
    payments,
    createWorkerSettlementCompliance(db, env, domainEventSink),
    new PaymentTierPolicy(tierLimits),
    new PlatformFeePolicy(legalEntities),
    xeroStack.accountingProvider,
    {
      stageDispatch: async ({ userId, payload, idempotencyKey }) => {
        await outbox.stage({ userId, payload, idempotencyKey });
      },
    },
    notificationFactory,
    {
      publish: async (event) => {
        await domainEventSink.publish({
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          payload: event.payload,
          actorUserId: event.actorUserId,
          actingLegalEntityId: event.actingLegalEntityId,
          producer: event.producer ?? "apps/worker",
        });
      },
    },
    new LotFulfilmentPaymentSync(new DrizzleLotFulfilmentRepository(db)),
    legalEntities,
    new DrizzleUserRepository(db),
    new InvoiceRecipients(new DrizzleLegalEntityNotificationRecipientRepository(db)),
  );
}

export { notificationRowToPayload };
