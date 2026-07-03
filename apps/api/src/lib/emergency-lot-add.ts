import type { Database } from "@auction/db";
import { DrizzleLotRepository } from "@auction/persistence";
import type { Lot, Sale } from "@auction/types";
import type { ILotJobScheduler } from "../services/interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "../services/interfaces/lot-lifecycle-recorder.js";
import type { ILotRepository } from "../services/interfaces/repositories.js";
import { LotError } from "./errors.js";

export function nextLotNumberForSale(lots: readonly Lot[]): number {
  const maxNum = lots.reduce((m, l) => Math.max(m, l.lotNumber ?? 0), 0);
  return maxNum + 1;
}

export function resolveLotNumberForEmergencyAdd(input: {
  sale: Sale;
  requestedLotNumber: number | null | undefined;
  inSaleLots: readonly Lot[];
}): number | undefined {
  if (input.sale.status === "draft") {
    return input.requestedLotNumber ?? undefined;
  }
  if (input.requestedLotNumber != null) {
    return input.requestedLotNumber;
  }
  return nextLotNumberForSale(input.inSaleLots);
}

export type RollbackEmergencyLotAddDeps = {
  lotRepo: ILotRepository;
  jobScheduler: ILotJobScheduler | null;
  lotLifecycleRecording?: ILotLifecycleRecorder | null;
  db?: Database | null;
  recordLotLifecycle?: ((fn: (tx: Database) => Promise<void>) => Promise<void>) | null;
};

/** Detach a draft lot from a live sale when emergency publish fails after create. */
export async function rollbackFailedEmergencyLotAdd(
  lot: Lot,
  deps: RollbackEmergencyLotAddDeps,
): Promise<void> {
  if (lot.status !== "draft" || lot.saleId == null) return;

  await deps.jobScheduler?.cancelLotJobs(lot.id);
  const fromSaleId = lot.saleId;

  if (deps.db && deps.lotLifecycleRecording) {
    await deps.db.transaction(async (tx) => {
      const lotRepo = new DrizzleLotRepository(tx);
      await lotRepo.clearSaleId(lot.id);
      await deps.lotLifecycleRecording?.recordDetached(tx, lot, fromSaleId);
    });
    return;
  }

  await deps.lotRepo.clearSaleId(lot.id);
  if (deps.lotLifecycleRecording && deps.recordLotLifecycle) {
    await deps.recordLotLifecycle(async (tx) => {
      await deps.lotLifecycleRecording?.recordDetached(tx, lot, fromSaleId);
    });
  }
}

export function emergencyAddPublishFailedError(
  publishError: LotError,
  lotId: string,
  rolledBack: boolean,
): LotError {
  return new LotError(publishError.message, publishError.status, "emergency_add_publish_failed", {
    lotId,
    rolledBack,
    ...(publishError.code ? { originalCode: publishError.code } : {}),
  });
}
