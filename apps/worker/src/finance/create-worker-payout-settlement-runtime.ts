import type { Database } from "@auction/db";
import {
  type FinanceRuntimeEnv,
  type PayoutSettlementRuntime,
  createPayoutSettlementRuntime,
} from "@auction/finance-runtime";
import {
  DrizzleConnectTransferRepository,
  DrizzleLegalEntityConnectRepository,
  DrizzlePayoutRepository,
  DrizzleTransactionRunner,
} from "@auction/persistence/repositories";
import type pino from "pino";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import { workerDomainEventPublisher } from "./worker-domain-event-publisher.js";
import { workerFinanceDomainEventSinkPort } from "./worker-finance-domain-event-port.js";

export function createWorkerPayoutSettlementRuntime(input: {
  env: FinanceRuntimeEnv;
  log: pino.Logger;
  db: Database;
  domainEventSink: IWorkerDomainEventSink;
}): PayoutSettlementRuntime {
  const payoutRepo = new DrizzlePayoutRepository(input.db);
  return createPayoutSettlementRuntime({
    env: input.env,
    log: input.log,
    payoutRepo,
    transactionRunner: new DrizzleTransactionRunner(input.db),
    connectTransferRepo: new DrizzleConnectTransferRepository(input.db),
    legalEntityConnectRepo: new DrizzleLegalEntityConnectRepository(input.db),
    domainEventSink: workerFinanceDomainEventSinkPort(input.domainEventSink),
    domainEventPublisher: workerDomainEventPublisher(input.domainEventSink),
  });
}

export function createWorkerPayoutSettlementContext(input: {
  env: FinanceRuntimeEnv;
  log: pino.Logger;
  db: Database;
  domainEventSink: IWorkerDomainEventSink;
}): { runtime: PayoutSettlementRuntime } {
  return { runtime: createWorkerPayoutSettlementRuntime(input) };
}
