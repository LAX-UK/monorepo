import type { Database } from "@auction/db";
import { LifecycleCronService, PaymentMaintenanceCronService } from "@auction/finance-cron-app";
import type { IFinanceCronHandlers } from "@auction/finance-cron-app";
import {
  type BulkSettlementWithTransfersResult,
  type FinanceRuntimeEnv,
  PaymentRefundReconcileService,
  createXeroAccountingStack,
} from "@auction/finance-runtime";
import {
  DrizzleAddressRepository,
  DrizzleDisplayPairingRepository,
  DrizzleLegalEntityMembershipReader,
  DrizzleLegalEntityReader,
  DrizzleLegalEntityRepository,
  DrizzleLotRepository,
  DrizzleNotificationOutboxRepository,
  DrizzlePaymentExternalRefRepository,
  DrizzlePaymentRefundReconcileRepository,
  DrizzlePaymentRepository,
  DrizzlePayoutRepository,
  DrizzleProfileRepository,
  DrizzleRepositoryFactory,
  DrizzleTransactionRunner,
  DrizzleUserRepository,
  DrizzleXeroConnectionRepository,
  DrizzleXeroWebhookEventRepository,
} from "@auction/persistence/repositories";
import type { Redis } from "ioredis";
import type pino from "pino";
import type { WorkerRepositories } from "../container/create-worker-repositories.js";
import type { WorkerEnv } from "../env.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import { createWorkerLotInvoiceInitiationService } from "./create-worker-lot-invoice-initiation.js";
import { createWorkerPayoutSettlementContext } from "./create-worker-payout-settlement-runtime.js";
import { runWorkerBulkPayoutSettlement } from "./worker-bulk-payout-settlement.js";
import { workerFinanceDomainEventSinkPort } from "./worker-finance-domain-event-port.js";
import { WorkerNotificationOutboxDrain } from "./worker-notification-outbox-drain.js";
import { WorkerPaymentMaintenanceAdapter } from "./worker-payment-maintenance-adapter.js";

export type CreateWorkerFinanceServicesInput = {
  env: WorkerEnv;
  log: pino.Logger;
  db: Database;
  redis: Redis;
  domainEventSink: IWorkerDomainEventSink;
  repos: WorkerRepositories;
};

export type WorkerFinanceServices = {
  handlers: IFinanceCronHandlers;
  accountingReplay: ReturnType<typeof createXeroAccountingStack>["accountingReplayCronService"];
  xeroStack: ReturnType<typeof createXeroAccountingStack>;
  ensureLotInvoice: (
    lotId: string,
  ) => Promise<import("@auction/finance-runtime").EnsureLotInvoiceResult>;
};

export function financeRuntimeEnvFromWorkerEnv(env: WorkerEnv): FinanceRuntimeEnv {
  return {
    NODE_ENV: env.NODE_ENV,
    XERO_CLIENT_ID: env.XERO_CLIENT_ID,
    XERO_CLIENT_SECRET: env.XERO_CLIENT_SECRET,
    XERO_REDIRECT_URI: env.XERO_REDIRECT_URI,
    XERO_DEFAULT_REVENUE_ACCOUNT_CODE: env.XERO_DEFAULT_REVENUE_ACCOUNT_CODE,
    XERO_DEFAULT_TAX_TYPE: env.XERO_DEFAULT_TAX_TYPE,
    XERO_INVOICE_DUE_DAYS: env.XERO_INVOICE_DUE_DAYS,
    XERO_USE_LEGAL_ENTITY_CONTACT: env.XERO_USE_LEGAL_ENTITY_CONTACT,
    XERO_PAYOUT_BILL_ACCOUNT_CODE: env.XERO_PAYOUT_BILL_ACCOUNT_CODE,
    XERO_PAYMENT_BANK_ACCOUNT_CODE: env.XERO_PAYMENT_BANK_ACCOUNT_CODE,
    XERO_API_WRITES_DISABLED: env.XERO_API_WRITES_DISABLED,
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    DISABLE_PAYOUT_SETTLEMENT: env.DISABLE_PAYOUT_SETTLEMENT,
    LOG_LEVEL: env.LOG_LEVEL,
  };
}

export function createWorkerFinanceServices(
  input: CreateWorkerFinanceServicesInput,
): WorkerFinanceServices {
  const { env, log, db, redis, domainEventSink, repos } = input;
  const financeEnv = financeRuntimeEnvFromWorkerEnv(env);
  const payments = new DrizzlePaymentRepository(db);
  const lots = new DrizzleLotRepository(db);
  const users = new DrizzleUserRepository(db);

  const paymentMaintenance = new WorkerPaymentMaintenanceAdapter({
    payments,
    accounting: null,
    lots,
    users,
    publishCancelled: async (event) => {
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
  });

  const xeroStack = createXeroAccountingStack({
    env: financeEnv,
    redis,
    log,
    connections: new DrizzleXeroConnectionRepository(db),
    externalRefs: new DrizzlePaymentExternalRefRepository(db),
    payments,
    payouts: new DrizzlePayoutRepository(db),
    refundReconcileRepo: new DrizzlePaymentRefundReconcileRepository(db),
    webhookEvents: new DrizzleXeroWebhookEventRepository(db),
    legalEntities: new DrizzleLegalEntityRepository(
      new DrizzleLegalEntityReader(db),
      new DrizzleLegalEntityMembershipReader(db),
    ),
    profileReader: new DrizzleProfileRepository(db),
    addressRepo: new DrizzleAddressRepository(db),
    paymentMaintenance,
  });

  paymentMaintenance.setAccountingProvider(xeroStack.accountingProvider);

  const lotInvoiceInitiation = createWorkerLotInvoiceInitiationService({
    db,
    env,
    domainEventSink,
    xeroStack,
  });

  const payoutSettlement = createWorkerPayoutSettlementContext({
    env: financeEnv,
    log,
    db,
    domainEventSink,
  });

  const refundReconcile = new PaymentRefundReconcileService(
    new DrizzleTransactionRunner(db),
    payments,
    payoutSettlement.runtime.payoutAdjustments,
    workerFinanceDomainEventSinkPort(domainEventSink),
    new DrizzlePaymentRefundReconcileRepository(db),
  );

  const paymentMaintenanceCronService = new PaymentMaintenanceCronService(
    paymentMaintenance,
    refundReconcile,
  );

  const notificationOutboxDrain = new WorkerNotificationOutboxDrain({
    outbox: new DrizzleNotificationOutboxRepository(db),
    notificationWrite: repos.notificationWriteRepo,
    redis,
  });

  const lifecycleCronService = new LifecycleCronService(
    { runTransitions: async () => {} },
    { reconcileSaleStatuses: async () => {} },
    notificationOutboxDrain,
  );

  const displayPairingRepo = new DrizzleDisplayPairingRepository(db);
  const repoFactory = new DrizzleRepositoryFactory(db);

  const handlers: IFinanceCronHandlers = {
    expireStalePayments: (pendingDays, authorizedDays) =>
      paymentMaintenanceCronService.expireStalePayments(pendingDays, authorizedDays),
    retryRefundReconciles: () => paymentMaintenanceCronService.retryRefundReconciles(),
    refreshXeroTokens: async () => {
      const result = await xeroStack.accountingReplayCronService.refreshXeroTokens();
      if (!result.ok) throw new Error(result.error ?? "refresh_xero_tokens_failed");
      return result.result;
    },
    retryXeroWebhookFailures: () =>
      xeroStack.accountingReplayCronService.retryXeroWebhookFailures(),
    retryXeroStripeCaptureSync: async () => {
      const result = await xeroStack.accountingReplayCronService.retryXeroStripeCaptureSync();
      if (!result.ok) throw new Error(result.error ?? "retry_xero_stripe_capture_sync_failed");
      return result.data;
    },
    retryXeroInvoiceCreation: async () => {
      const result = await xeroStack.accountingReplayCronService.retryXeroInvoiceCreation();
      if (!result.ok) throw new Error(result.error ?? "retry_xero_invoice_creation_failed");
      return result.data;
    },
    ensureLotInvoices: async () => {
      const lotIds = await repoFactory.root.lot.listSoldLotsMissingPayment(50);
      const settled = await Promise.allSettled(
        lotIds.map((id) => lotInvoiceInitiation.ensureForLot(id)),
      );
      const results = settled.map((outcome, index) => {
        if (outcome.status === "fulfilled") return outcome.value;
        return {
          created: false,
          reason: "ensure_failed",
          lotId: lotIds[index],
          error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        };
      });
      return {
        processed: lotIds.length,
        created: results.filter((r) => r.created).length,
        failed: settled.filter((r) => r.status === "rejected").length,
        results,
      };
    },
    processNotificationOutbox: () => lifecycleCronService.processNotificationOutbox(),
    cleanupDisplayPairings: async () => {
      const now = new Date();
      const expiredPending = await displayPairingRepo.markExpiredStalePending(now);
      const purgeBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const purged = await displayPairingRepo.purgeTerminalRows(purgeBefore);
      return { expiredPending, purged };
    },
    runBulkPayoutSettlement: async () => {
      const result = await runWorkerBulkPayoutSettlement({
        env: financeEnv,
        redis,
        log,
        settlement: payoutSettlement,
      });
      if ("skipped" in result && result.skipped) {
        return {
          deferred: true as const,
          reason: "settlement_already_running" as const,
        };
      }
      const settled = result as BulkSettlementWithTransfersResult;
      return {
        settlement: settled.settlement,
        transfers: settled.transfers,
      };
    },
  };

  return {
    handlers,
    accountingReplay: xeroStack.accountingReplayCronService,
    xeroStack,
    ensureLotInvoice: (lotId) => lotInvoiceInitiation.ensureForLot(lotId),
  };
}
