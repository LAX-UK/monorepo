import type { Database } from "@auction/db";
import type { SaleServiceDeps } from "./sale-types.js";

export type { SaleServiceDeps } from "./sale-types.js";

export function txRepos(deps: SaleServiceDeps, tx: Database) {
  if (!deps.repoFactory) {
    throw new Error("sale_service_repo_factory_required");
  }
  return deps.repoFactory.forTransaction(tx);
}

export async function recordLotLifecycle(
  deps: SaleServiceDeps,
  fn: (tx: Database) => Promise<void>,
): Promise<void> {
  if (!deps.transactionRunner || !deps.lotLifecycleRecording) return;
  await deps.transactionRunner.runInTransaction(fn);
}

export async function publishSaleEvent(
  deps: SaleServiceDeps,
  actorUserId: string,
  saleId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!deps.domainEventSink) return;
  await deps.domainEventSink.publish({
    aggregateType: "sale",
    aggregateId: saleId,
    eventType,
    payload,
    actorUserId,
  });
}

export function publishSingleLotDeps(deps: SaleServiceDeps) {
  return {
    lotRepo: deps.lotRepo,
    jobScheduler: deps.jobScheduler,
    lotLifecycleRecording: deps.lotLifecycleRecording,
    transactionRunner: deps.transactionRunner ?? null,
    repoFactory: deps.repoFactory ?? null,
    recordLotLifecycle: (fn: (tx: Database) => Promise<void>) => recordLotLifecycle(deps, fn),
    legalEntityRepository: deps.legalEntityRepository,
    enforceIndividualConnectOnPublish: deps.enforceIndividualConnectOnPublish,
  };
}

export function scheduleRollbackDeps(deps: SaleServiceDeps) {
  return {
    jobScheduler: deps.jobScheduler,
    lotRepo: deps.lotRepo,
    lotLifecycleRecording: deps.lotLifecycleRecording,
    transactionRunner: deps.transactionRunner ?? null,
    repoFactory: deps.repoFactory ?? null,
    recordLotLifecycle: (fn: (tx: Database) => Promise<void>) => recordLotLifecycle(deps, fn),
  };
}
