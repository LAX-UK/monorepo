import type { CreateLotInput, Lot } from "@auction/types";
import { normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import {
  englishOnlyAdminLotAuctionTypeViolation,
  isStartInFutureForPublish,
} from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import { type AuthzError, LotError, missingCatalogueCapabilityError } from "../../lib/errors.js";
import { recordLifecycle, txLot } from "./lot-mutation-context.js";
import { mapLotUpdateDbError } from "./lot-number.js";
import { prepareSaleAssignmentPatch } from "./lot-sale-membership.js";
import { applySaleTimingPolicyToLot } from "./lot-sale-timing.js";
import type { LotServiceDeps } from "./lot-types.js";

export async function updateLot(
  deps: LotServiceDeps,
  userRole: string,
  lotId: string,
  input: Partial<CreateLotInput>,
  userStaffRole?: string | null,
): Promise<Result<Lot, LotError | AuthzError>> {
  const role = normalizeUserRoleOrClient(userRole);
  const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
  if (!canManageCatalogue(role, staff)) {
    return err(
      missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can edit lots",
        role,
        staff,
      ),
    );
  }
  const a = await deps.lotRepo.findById(lotId);
  if (!a) return err(new LotError("Lot not found", 404));

  if (a.status === "ended" || a.status === "cancelled" || a.status === "voided") {
    return err(new LotError("This lot cannot be edited"));
  }

  if (a.status === "active") {
    if (input.images === undefined) {
      return err(new LotError("Only images can be edited on an active lot"));
    }
    const updated = await deps.lotRepo.update(lotId, { images: input.images });
    await deps.imageCleanup?.enqueueRemovedMany(a.images, input.images);
    return ok(updated);
  }

  const lockMsg = englishOnlyAdminLotAuctionTypeViolation({
    enabled: deps.englishOnlyAuctions,
    existing: a.auctionType,
    ...(input.auctionType !== undefined ? { requested: input.auctionType } : {}),
  });
  if (lockMsg) {
    return err(new LotError(lockMsg));
  }
  const patchResult = await prepareSaleAssignmentPatch(deps, lotId, a, input);
  if (patchResult.isErr()) {
    return err(patchResult.error);
  }
  const timingPatchResult = await applySaleTimingPolicyToLot(deps, a, patchResult.value);
  if (timingPatchResult.isErr()) {
    return err(timingPatchResult.error);
  }
  const patch = timingPatchResult.value;
  const nextStart = patch.startTime ?? a.startTime;
  const nextEnd = patch.endTime ?? a.endTime;
  if (nextEnd <= nextStart) {
    return err(new LotError("endTime must be after startTime"));
  }
  if (
    a.status === "scheduled" &&
    (patch.startTime !== undefined || patch.endTime !== undefined) &&
    !isStartInFutureForPublish(nextStart)
  ) {
    return err(new LotError("startTime must be in the future for scheduled lots"));
  }
  let updated: Lot;
  try {
    if (
      patch.saleId !== undefined &&
      patch.saleId !== a.saleId &&
      deps.transactionRunner &&
      deps.lotLifecycleRecording
    ) {
      updated = await deps.transactionRunner.runInTransaction(async (tx) => {
        const lotRepo = txLot(deps, tx);
        const row = await lotRepo.update(lotId, patch);
        if (a.saleId && patch.saleId !== a.saleId) {
          await deps.lotLifecycleRecording?.recordDetached(tx, a, a.saleId);
        }
        if (patch.saleId) {
          await deps.lotLifecycleRecording?.recordAttached(tx, row, {
            saleId: patch.saleId,
            lotNumber: row.lotNumber,
            fromSaleId: a.saleId,
            via: "patch",
          });
        }
        return row;
      });
    } else {
      updated = await deps.lotRepo.update(lotId, patch);
      if (patch.saleId !== undefined && patch.saleId !== a.saleId) {
        await recordLifecycle(deps, async (tx) => {
          if (a.saleId && patch.saleId !== a.saleId) {
            await deps.lotLifecycleRecording?.recordDetached(tx, a, a.saleId);
          }
          if (patch.saleId) {
            await deps.lotLifecycleRecording?.recordAttached(tx, updated, {
              saleId: patch.saleId,
              lotNumber: updated.lotNumber,
              fromSaleId: a.saleId,
              via: "patch",
            });
          }
        });
      }
    }
  } catch (error) {
    const mapped = mapLotUpdateDbError(error);
    if (mapped) {
      return err(mapped);
    }
    throw error;
  }
  if (patch.images !== undefined) {
    await deps.imageCleanup?.enqueueRemovedMany(a.images, patch.images);
  }
  if (a.status === "scheduled" && deps.jobScheduler) {
    const timesChanged =
      nextStart.getTime() !== a.startTime.getTime() || nextEnd.getTime() !== a.endTime.getTime();
    if (timesChanged) {
      await deps.jobScheduler.cancelLotJobs(lotId);
      await deps.jobScheduler.scheduleLot(lotId, nextStart, nextEnd);
    }
  }
  return ok(updated);
}

export async function updateLotMarketingDetails(
  deps: LotServiceDeps,
  userRole: string,
  lotId: string,
  patch: UpdateLotMarketingDetailsInput,
  userStaffRole?: string | null,
): Promise<Result<Lot, LotError | AuthzError>> {
  const role = normalizeUserRoleOrClient(userRole);
  const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
  if (!canManageCatalogue(role, staff)) {
    return err(
      missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can update marketing details",
        role,
        staff,
      ),
    );
  }
  const a = await deps.lotRepo.findById(lotId);
  if (!a) return err(new LotError("Lot not found", 404));
  if (a.status === "cancelled" || a.status === "ended") {
    return err(new LotError("Cannot update marketing details for this lot", 400));
  }
  const updated = await deps.lotRepo.updateMarketingDetails(lotId, patch);
  return ok(updated);
}
