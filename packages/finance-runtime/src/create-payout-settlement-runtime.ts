import type { Database } from "@auction/db";
import type {
  IConnectTransferRepository,
  ILegalEntityConnectRepository,
  IPayoutRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import type { IDomainEventPublisher } from "./domain-event-publisher.js";
import type { IDomainEventSinkPort } from "./domain-event-sink-port.js";
import type { FinanceRuntimeEnv } from "./env-slice.js";
import { PayoutAdjustmentService } from "./payout/payout-adjustment.service.js";
import { runBulkSettlementWithTransfers } from "./payout/payout-bulk-transfer.js";
import { type PayoutSettlementDeps, payoutRepoForTx } from "./payout/payout-helpers.js";
import type {
  BulkSettlementTransferPort,
  BulkSettlementWithTransfersResult,
} from "./payout/types.js";
import {
  ConnectLifecyclePromoter,
  ConnectReadinessSyncService,
} from "./stripe/connect-readiness-sync.js";
import { ConnectTransferInitiationService } from "./stripe/connect-transfer-initiation.service.js";
import { StripeClientFactory } from "./stripe/stripe-client-factory.js";

export type CreatePayoutSettlementRuntimeInput = {
  env: FinanceRuntimeEnv;
  log: Logger;
  payoutRepo: IPayoutRepository;
  transactionRunner: ITransactionRunner;
  connectTransferRepo: IConnectTransferRepository;
  legalEntityConnectRepo: ILegalEntityConnectRepository;
  domainEventSink: IDomainEventSinkPort;
  domainEventPublisher: IDomainEventPublisher;
};

export type PayoutSettlementRuntime = {
  deps: PayoutSettlementDeps;
  transferInitiation: ConnectTransferInitiationService;
  payoutAdjustments: PayoutAdjustmentService;
  runBulkSettlementWithTransfers: (opts?: {
    periodEnd?: Date;
    onEntityOutcome?: BulkSettlementTransferPort["onEntityOutcome"];
  }) => Promise<BulkSettlementWithTransfersResult>;
};

export function createPayoutSettlementRuntime(
  input: CreatePayoutSettlementRuntimeInput,
): PayoutSettlementRuntime {
  const payoutAdjustments = new PayoutAdjustmentService(input.transactionRunner, input.payoutRepo);

  const deps: PayoutSettlementDeps = {
    repo: input.payoutRepo,
    transactionRunner: input.transactionRunner,
    domainEventSink: input.domainEventSink,
    payoutAdjustments,
    payoutRepoForTx: (tx: Database) => payoutRepoForTx(input.payoutRepo, tx),
  };

  const stripeFactory = new StripeClientFactory(input.env.STRIPE_SECRET_KEY);
  const lifecyclePromoter = new ConnectLifecyclePromoter(
    input.legalEntityConnectRepo,
    input.domainEventSink,
  );
  const accountSync = new ConnectReadinessSyncService(
    input.transactionRunner,
    input.legalEntityConnectRepo,
    stripeFactory,
    lifecyclePromoter,
  );

  const transferInitiation = new ConnectTransferInitiationService(
    input.log.child({ component: "connect_transfer_initiation" }),
    input.connectTransferRepo,
    stripeFactory,
    accountSync,
    input.payoutRepo,
    input.domainEventPublisher,
  );

  return {
    deps,
    transferInitiation,
    payoutAdjustments,
    runBulkSettlementWithTransfers: (opts) => {
      const port: BulkSettlementTransferPort = {
        initiateTransfer: (payoutId, transferOpts) =>
          transferInitiation.initiateTransfer(payoutId, transferOpts),
        ...(opts?.onEntityOutcome ? { onEntityOutcome: opts.onEntityOutcome } : {}),
      };
      return runBulkSettlementWithTransfers(
        deps,
        null,
        port,
        opts?.periodEnd !== undefined ? { periodEnd: opts.periodEnd } : {},
      );
    },
  };
}
