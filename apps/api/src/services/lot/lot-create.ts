import type { CreateLotInput, Lot } from "@auction/types";
import { englishOnlyAdminLotAuctionTypeViolation } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import {
  emergencyAddPublishFailedError,
  resolveLotNumberForEmergencyAdd,
  rollbackFailedEmergencyLotAdd,
} from "../../lib/emergency-lot-add.js";
import { LotError } from "../../lib/errors.js";
import { publishSingleLot } from "../../lib/publish-single-lot.js";
import { publishSingleLotDeps, recordLifecycle, txLot } from "./lot-mutation-context.js";
import { mapLotNumberConstraintError } from "./lot-number.js";
import { applySaleTimingPolicyToInput } from "./lot-sale-timing.js";
import type { LotServiceDeps } from "./lot-types.js";

export async function createLot(
  deps: LotServiceDeps,
  _sellerId: string,
  input: CreateLotInput,
): Promise<Result<Lot, LotError>> {
  if (input.endTime <= input.startTime) {
    return err(new LotError("endTime must be after startTime"));
  }
  const lockMsg = englishOnlyAdminLotAuctionTypeViolation({
    enabled: deps.englishOnlyAuctions,
    requested: input.auctionType,
  });
  if (lockMsg) {
    return err(new LotError(lockMsg));
  }
  const timingResult = await applySaleTimingPolicyToInput(deps, input.saleId ?? null, input);
  if (timingResult.isErr()) {
    return err(timingResult.error);
  }
  const { input: timedInput, sale: saleForPublish } = timingResult.value;
  const createdSource =
    saleForPublish && saleForPublish.status !== "draft"
      ? ("emergency_add" as const)
      : ("staff_create" as const);
  let createPayload = timedInput;
  if (saleForPublish && saleForPublish.status !== "draft") {
    const inSaleLots = await deps.lotRepo.findBySaleId(saleForPublish.id);
    const lotNumber = resolveLotNumberForEmergencyAdd({
      sale: saleForPublish,
      requestedLotNumber: createPayload.lotNumber,
      inSaleLots,
    });
    if (lotNumber !== undefined) {
      createPayload = { ...createPayload, lotNumber };
    }
  }
  if (deps.transactionRunner && deps.lotLifecycleRecording) {
    let created: Lot;
    try {
      created = await deps.transactionRunner.runInTransaction(async (tx) => {
        const lotRepo = txLot(deps, tx);
        const row = await lotRepo.create(createPayload);
        await deps.lotLifecycleRecording?.recordCreated(tx, {
          lot: row,
          source: createdSource,
        });
        return row;
      });
    } catch (e) {
      const mapped = mapLotNumberConstraintError(e);
      if (mapped) return err(mapped);
      throw e;
    }
    await deps.qrCodeService?.getOrCreateDefault({
      entityType: "lot",
      entityId: created.id,
    });
    if (saleForPublish && saleForPublish.status !== "draft") {
      const published = await publishSingleLot(
        { lot: created, sale: saleForPublish },
        publishSingleLotDeps(deps),
      );
      if (published.isErr()) {
        await rollbackFailedEmergencyLotAdd(created, publishSingleLotDeps(deps));
        return err(emergencyAddPublishFailedError(published.error, created.id, true));
      }
      return ok(published.value);
    }
    return ok(created);
  }
  let created: Lot;
  try {
    created = await deps.lotRepo.create(createPayload);
  } catch (e) {
    const mapped = mapLotNumberConstraintError(e);
    if (mapped) return err(mapped);
    throw e;
  }
  await recordLifecycle(deps, async (tx) => {
    await deps.lotLifecycleRecording?.recordCreated(tx, {
      lot: created,
      source: createdSource,
    });
  });
  await deps.qrCodeService?.getOrCreateDefault({
    entityType: "lot",
    entityId: created.id,
  });
  if (saleForPublish && saleForPublish.status !== "draft") {
    const published = await publishSingleLot(
      { lot: created, sale: saleForPublish },
      publishSingleLotDeps(deps),
    );
    if (published.isErr()) {
      await rollbackFailedEmergencyLotAdd(created, publishSingleLotDeps(deps));
      return err(emergencyAddPublishFailedError(published.error, created.id, true));
    }
    return ok(published.value);
  }
  return ok(created);
}
