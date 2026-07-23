import type { Database } from "@auction/db";
import { parsePaymentTierLimits } from "@auction/domain";
import {
  LotInvoiceInitiationService,
  PaymentTierPolicy,
  PlatformFeePolicy,
} from "@auction/finance-runtime";
import type { XeroAccountingStack } from "@auction/finance-runtime";
import {
  DrizzleLegalEntityMembershipReader,
  DrizzleLegalEntityReader,
  DrizzleLegalEntityRepository,
  DrizzleLotRepository,
  DrizzleNotificationOutboxRepository,
  DrizzlePaymentRepository,
  DrizzleSaleRepository,
  DrizzleUserRepository,
} from "@auction/persistence/repositories";
import type { WorkerEnv } from "../env.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import {
  WorkerNotificationFactory,
  notificationRowToPayload,
} from "../lifecycle/worker-notification-factory.js";

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
    null,
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
    null,
    legalEntities,
    new DrizzleUserRepository(db),
    env.XERO_API_WRITES_DISABLED,
  );
}

export { notificationRowToPayload };
