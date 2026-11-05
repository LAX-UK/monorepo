import type { Database } from "@auction/db";
import {
  type IFinanceCronHandlers,
  PaymentMaintenanceCronService,
} from "@auction/finance-cron-app";
import type pino from "pino";
import type { WorkerRepositories } from "../container/create-worker-repositories.js";
import type { WorkerEnv } from "../env.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import {
  type WorkerFinanceServices,
  createWorkerFinanceServices,
} from "./create-worker-finance-services.js";
import { createWorkerStalePaymentExpiry } from "./create-worker-stale-payment-expiry.js";

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
        createWorkerStalePaymentExpiry({
          db: input.db,
          env: input.env,
          domainEventSink: input.domainEventSink,
        })(pendingDays, authorizedDays ?? pendingDays * 2),
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
