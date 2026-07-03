import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence";
import type { Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { ILotJobScheduler } from "../services/interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "../services/interfaces/lot-lifecycle-recorder.js";
import type { ILotRepository, ISaleRepository } from "../services/interfaces/repositories.js";
import type { IRepositoryFactory } from "../services/interfaces/repository-factory.js";
import { LotError } from "./errors.js";

export const SCHEDULE_JOBS_FAILED_MESSAGE =
  "Lot could not be scheduled because lifecycle jobs failed to enqueue. Status reverted to draft.";

export function scheduleJobsFailedError(): LotError {
  return new LotError(SCHEDULE_JOBS_FAILED_MESSAGE, 503, "schedule_jobs_failed");
}

export type ScheduleLotRollbackDeps = {
  jobScheduler: ILotJobScheduler | null;
  lotRepo: ILotRepository;
  lotLifecycleRecording?: ILotLifecycleRecorder | null;
  transactionRunner?: ITransactionRunner | null;
  repoFactory?: IRepositoryFactory | null;
  recordLotLifecycle?: ((fn: (tx: Database) => Promise<void>) => Promise<void>) | null;
};

export type ScheduleLotWithRollbackInput = ScheduleLotRollbackDeps & {
  lotId: string;
  startTime: Date;
  endTime: Date;
  actorUserId?: string | null;
  unpublishReason?: "manual" | "sale_unpublish";
};

async function revertLotToDraft(input: ScheduleLotWithRollbackInput): Promise<void> {
  const { lotId, unpublishReason, actorUserId } = input;
  if (
    input.transactionRunner &&
    input.repoFactory &&
    input.lotLifecycleRecording &&
    unpublishReason
  ) {
    const repoFactory = input.repoFactory;
    await input.transactionRunner.runInTransaction(async (tx) => {
      const lotRepo = repoFactory.forTransaction(tx).lot;
      await lotRepo.updateStatus(lotId, "draft");
      const row = await lotRepo.findById(lotId);
      if (row) {
        await input.lotLifecycleRecording?.recordUnpublished(tx, row, unpublishReason, actorUserId);
      }
    });
    return;
  }
  await input.lotRepo.updateStatus(lotId, "draft");
  if (input.lotLifecycleRecording && unpublishReason && input.recordLotLifecycle) {
    const row = await input.lotRepo.findById(lotId);
    if (row) {
      await input.recordLotLifecycle(async (tx) => {
        await input.lotLifecycleRecording?.recordUnpublished(tx, row, unpublishReason, actorUserId);
      });
    }
  }
}

/** Schedule BullMQ jobs for a lot; on failure cancel jobs and revert lot status to draft. */
export async function scheduleLotWithDraftRollback(
  input: ScheduleLotWithRollbackInput,
): Promise<Result<void, LotError>> {
  try {
    await input.jobScheduler?.scheduleLot(input.lotId, input.startTime, input.endTime);
    return ok(undefined);
  } catch {
    await input.jobScheduler?.cancelLotJobs(input.lotId);
    await revertLotToDraft(input);
    return err(scheduleJobsFailedError());
  }
}

export type RollbackSalePublishInput = ScheduleLotRollbackDeps & {
  saleRepo: ISaleRepository;
  saleId: string;
  lots: Lot[];
  scheduledLotIds: string[];
  actorUserId?: string | null;
};

/** Compensating rollback when sale publish job scheduling fails mid-loop. */
export async function rollbackSalePublishOnScheduleFailure(
  input: RollbackSalePublishInput,
): Promise<void> {
  for (const lotId of input.scheduledLotIds) {
    await input.jobScheduler?.cancelLotJobs(lotId);
  }
  if (input.transactionRunner && input.repoFactory && input.lotLifecycleRecording) {
    const repoFactory = input.repoFactory;
    await input.transactionRunner.runInTransaction(async (tx) => {
      const saleRepo = repoFactory.forTransaction(tx).sale;
      const lotRepo = repoFactory.forTransaction(tx).lot;
      for (const l of input.lots) {
        await lotRepo.updateStatus(l.id, "draft");
        const row = await lotRepo.findById(l.id);
        if (row) {
          await input.lotLifecycleRecording?.recordUnpublished(
            tx,
            row,
            "sale_unpublish",
            input.actorUserId,
          );
        }
      }
      await saleRepo.updateStatus(input.saleId, "draft");
    });
    return;
  }
  for (const l of input.lots) {
    await input.lotRepo.updateStatus(l.id, "draft");
    if (input.lotLifecycleRecording && input.recordLotLifecycle) {
      await input.recordLotLifecycle(async (tx) => {
        await input.lotLifecycleRecording?.recordUnpublished(
          tx,
          { ...l, status: "draft" },
          "sale_unpublish",
          input.actorUserId,
        );
      });
    }
  }
  await input.saleRepo.updateStatus(input.saleId, "draft");
}
