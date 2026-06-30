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
  if (!deps.db || !deps.lotLifecycleRecording) return;
  await deps.db.transaction(fn);
}

export async function publishSaleEvent(
  deps: SaleServiceDeps,
  actorUserId: string,
  saleId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!deps.db || !deps.domainEventPublisher) return;
  await deps.domainEventPublisher.publish(deps.db, {
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
    db: deps.db ?? null,
    recordLotLifecycle: (fn: (tx: Database) => Promise<void>) => recordLotLifecycle(deps, fn),
    legalEntityRepository: deps.legalEntityRepository,
    enforceIndividualConnectOnPublish: deps.enforceIndividualConnectOnPublish,
  };
}
