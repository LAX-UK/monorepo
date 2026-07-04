import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { ILotRepository } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import type { Lot, Sale } from "@auction/types";
import { getSaleModeCapabilities } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { ILotJobScheduler } from "../services/interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "../services/interfaces/lot-lifecycle-recorder.js";
import { LotError } from "./errors.js";
import { assertLotPublishable } from "./lot-publish-policy.js";
import { resolveLotTimingForSale } from "./lot-sale-timing.js";
import { scheduleLotWithDraftRollback } from "./lot-schedule-jobs.js";
import { findLotsMissingSellerConnect } from "./seller-connect-readiness.js";

export type PublishSingleLotDeps = {
  lotRepo: ILotRepository;
  jobScheduler: ILotJobScheduler | null;
  lotLifecycleRecording?: ILotLifecycleRecorder | null;
  transactionRunner?: ITransactionRunner | null;
  repoFactory?: IRepositoryFactory | null;
  recordLotLifecycle?: ((fn: (tx: Database) => Promise<void>) => Promise<void>) | null;
  legalEntityRepository?: ILegalEntityRepository | null;
  enforceIndividualConnectOnPublish?: boolean;
};

export async function publishSingleLot(
  input: {
    lot: Lot;
    sale: Sale;
    actorUserId?: string | null;
  },
  deps: PublishSingleLotDeps,
): Promise<Result<Lot, LotError>> {
  const publishable = assertLotPublishable(input.lot, {
    sale: input.sale,
    requireCatalogue: true,
    rejectDraftSale: false,
  });
  if (!publishable.ok) {
    return err(publishable.error);
  }

  if (deps.enforceIndividualConnectOnPublish && deps.legalEntityRepository) {
    const blocked = await findLotsMissingSellerConnect([input.lot], deps.legalEntityRepository);
    if (blocked.length > 0) {
      return err(
        new LotError(
          "This seller must complete Stripe Connect onboarding before the lot can be scheduled.",
          409,
          "connect_required",
        ),
      );
    }
  }

  const alignedPatch = publishable.timing.alignedPatch;
  const caps = getSaleModeCapabilities(input.sale.deliveryMode);
  let updated: Lot;

  if (deps.transactionRunner && deps.repoFactory && deps.lotLifecycleRecording) {
    const repoFactory = deps.repoFactory;
    updated = await deps.transactionRunner.runInTransaction(async (tx) => {
      const lotRepo = repoFactory.forTransaction(tx).lot;
      if (alignedPatch) {
        await lotRepo.update(input.lot.id, alignedPatch);
      } else if (caps.inheritsLotTiming) {
        const resolved = resolveLotTimingForSale(
          input.sale,
          input.lot.startTime,
          input.lot.endTime,
        );
        if (
          resolved.ok &&
          (resolved.startTime.getTime() !== input.lot.startTime.getTime() ||
            resolved.endTime.getTime() !== input.lot.endTime.getTime())
        ) {
          await lotRepo.update(input.lot.id, {
            startTime: resolved.startTime,
            endTime: resolved.endTime,
          });
        }
      }
      await lotRepo.updateStatus(input.lot.id, "scheduled");
      const row = await lotRepo.findById(input.lot.id);
      if (!row) throw new LotError("Lot not found", 404);
      await deps.lotLifecycleRecording?.recordPublished(tx, row, input.actorUserId);
      return row;
    });
  } else {
    if (alignedPatch) {
      await deps.lotRepo.update(input.lot.id, alignedPatch);
    } else if (caps.inheritsLotTiming) {
      const resolved = resolveLotTimingForSale(input.sale, input.lot.startTime, input.lot.endTime);
      if (
        resolved.ok &&
        (resolved.startTime.getTime() !== input.lot.startTime.getTime() ||
          resolved.endTime.getTime() !== input.lot.endTime.getTime())
      ) {
        await deps.lotRepo.update(input.lot.id, {
          startTime: resolved.startTime,
          endTime: resolved.endTime,
        });
      }
    }
    await deps.lotRepo.updateStatus(input.lot.id, "scheduled");
    const row = await deps.lotRepo.findById(input.lot.id);
    if (!row) return err(new LotError("Lot not found", 404));
    updated = row;
    if (deps.lotLifecycleRecording && deps.recordLotLifecycle) {
      await deps.recordLotLifecycle(async (tx) => {
        await deps.lotLifecycleRecording?.recordPublished(tx, updated, input.actorUserId);
      });
    }
  }

  const lotStart = caps.inheritsLotTiming ? input.sale.startTime : updated.startTime;
  const lotEnd = caps.inheritsLotTiming ? input.sale.endTime : updated.endTime;
  const scheduleResult = await scheduleLotWithDraftRollback({
    jobScheduler: deps.jobScheduler,
    lotRepo: deps.lotRepo,
    lotLifecycleRecording: deps.lotLifecycleRecording ?? null,
    transactionRunner: deps.transactionRunner ?? null,
    repoFactory: deps.repoFactory ?? null,
    recordLotLifecycle: deps.recordLotLifecycle ?? null,
    lotId: updated.id,
    startTime: lotStart,
    endTime: lotEnd,
    actorUserId: input.actorUserId ?? null,
    unpublishReason: "manual",
  });
  if (scheduleResult.isErr()) {
    return err(scheduleResult.error);
  }

  const finalLot = await deps.lotRepo.findById(updated.id);
  if (!finalLot) return err(new LotError("Lot not found", 404));
  return ok(finalLot);
}
