import type { Database } from "@auction/db";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { LotServiceDeps } from "./lot-types.js";

export function txLot(deps: LotServiceDeps, tx: Database): ILotRepository {
  if (!deps.repoFactory) {
    throw new Error("lot_service_repo_factory_required");
  }
  return deps.repoFactory.forConnection(tx).lot;
}

export async function recordLifecycle(
  deps: LotServiceDeps,
  fn: (tx: Database) => Promise<void>,
): Promise<void> {
  if (!deps.transactionRunner || !deps.lotLifecycleRecording) return;
  await deps.transactionRunner.runInTransaction(fn);
}

export function publishSingleLotDeps(deps: LotServiceDeps) {
  return {
    lotRepo: deps.lotRepo,
    jobScheduler: deps.jobScheduler,
    lotLifecycleRecording: deps.lotLifecycleRecording,
    transactionRunner: deps.transactionRunner ?? null,
    repoFactory: deps.repoFactory ?? null,
    recordLotLifecycle: (fn: (tx: Database) => Promise<void>) => recordLifecycle(deps, fn),
    legalEntityRepository: deps.legalEntityRepository,
    enforceIndividualConnectOnPublish: deps.enforceIndividualConnectOnPublish,
  };
}
