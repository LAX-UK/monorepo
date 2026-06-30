import type { Database } from "@auction/db";
import type { ILotRepository } from "../interfaces/repositories.js";
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
  if (!deps.db || !deps.lotLifecycleRecording) return;
  await deps.db.transaction(async (tx) => fn(tx));
}

export function publishSingleLotDeps(deps: LotServiceDeps) {
  return {
    lotRepo: deps.lotRepo,
    jobScheduler: deps.jobScheduler,
    lotLifecycleRecording: deps.lotLifecycleRecording,
    db: deps.db ?? null,
    recordLotLifecycle: (fn: (tx: Database) => Promise<void>) => recordLifecycle(deps, fn),
    legalEntityRepository: deps.legalEntityRepository,
    enforceIndividualConnectOnPublish: deps.enforceIndividualConnectOnPublish,
  };
}
