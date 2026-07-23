import type { Database } from "@auction/db";
import {
  type IFinanceCronHandlers,
  PaymentMaintenanceCronService,
  expireStalePaymentsWithPorts,
} from "@auction/finance-cron-app";
import { DrizzlePaymentRepository } from "@auction/persistence/repositories";
import type pino from "pino";
import type { WorkerRepositories } from "../container/create-worker-repositories.js";
import type { WorkerEnv } from "../env.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import {
  type WorkerFinanceServices,
  createWorkerFinanceServices,
} from "./create-worker-finance-services.js";

export type CreateWorkerFinanceCronHandlersInput = {
  env: WorkerEnv;
  log: pino.Logger;
  cronSecret: string;
  db: Database;
  domainEventSink: IWorkerDomainEventSink;
  repos: WorkerRepositories;
  redis: import("ioredis").Redis;
  /** Pre-built local finance services (required for worker execution owner). */
  financeServices?: WorkerFinanceServices | null;
};

function paymentPorts(db: Database, domainEventSink: IWorkerDomainEventSink) {
  const payments = new DrizzlePaymentRepository(db);
  return {
    listStalePendingBefore: (cutoff: Date) => payments.listStalePendingBefore(cutoff),
    listStaleAuthorizedBefore: (cutoff: Date) => payments.listStaleAuthorizedBefore(cutoff),
    cancelPayment: (paymentId: string) => payments.updateStatus(paymentId, "cancelled"),
    publishPaymentCancelled: async (event: {
      paymentId: string;
      lotId: string;
      buyerUserId: string;
      reason: string;
    }) => {
      await domainEventSink.publish({
        aggregateType: "payment",
        aggregateId: event.paymentId,
        eventType: "payment.cancelled",
        payload: {
          lotId: event.lotId,
          buyerUserId: event.buyerUserId,
          reason: event.reason,
        },
        actorUserId: null,
        actingLegalEntityId: null,
        producer: "apps/worker",
      });
    },
  };
}

/**
 * Worker finance cron application handlers. When `financeServices` is provided, all jobs run locally.
 */
export function createWorkerFinanceCronHandlers(
  input: CreateWorkerFinanceCronHandlersInput,
): IFinanceCronHandlers {
  if (input.financeServices) {
    return input.financeServices.handlers;
  }

  const paymentMaintenanceCronService = new PaymentMaintenanceCronService(
    {
      expireStalePendingPayments: (pendingDays, authorizedDays) =>
        expireStalePaymentsWithPorts(
          paymentPorts(input.db, input.domainEventSink),
          pendingDays,
          authorizedDays ?? pendingDays * 2,
        ).then((r) => r.expired),
    },
    {
      replayPending: async () => ({ attempted: 0, reconciled: 0 }),
    },
  );

  return {
    expireStalePayments: (pendingDays, authorizedDays) =>
      paymentMaintenanceCronService.expireStalePayments(pendingDays, authorizedDays),
    retryRefundReconciles: () => paymentMaintenanceCronService.retryRefundReconciles(),
    refreshXeroTokens: async () => {
      throw new Error("finance_services_required_for_local_xero_cron");
    },
    retryXeroWebhookFailures: async () => {
      throw new Error("finance_services_required_for_local_xero_cron");
    },
    retryXeroStripeCaptureSync: async () => {
      throw new Error("finance_services_required_for_local_xero_cron");
    },
    retryXeroInvoiceCreation: async () => {
      throw new Error("finance_services_required_for_local_xero_cron");
    },
    ensureLotInvoices: async () => {
      throw new Error("finance_services_required_for_local_settlement_cron");
    },
    processNotificationOutbox: async () => {
      throw new Error("finance_services_required_for_local_notification_outbox");
    },
    cleanupDisplayPairings: async () => {
      throw new Error("finance_services_required_for_local_hygiene_cron");
    },
    runBulkPayoutSettlement: async () => {
      throw new Error("finance_services_required_for_local_bulk_settlement");
    },
  };
}

export { createWorkerFinanceServices };
