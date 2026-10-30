import type { Lot, Sale, StaffRoles } from "@auction/types";
import { normalizeUserRoleOrClient, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { LotCancelledPayload } from "../../domain/lot-events.js";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import { AuthzError, LotError, missingCatalogueCapabilityError } from "../../lib/errors.js";
import { assertLotPublishable } from "../../lib/lot-publish-policy.js";
import { scheduleLotWithDraftRollback } from "../../lib/lot-schedule-jobs.js";
import { findLotsMissingSellerConnect } from "../../lib/seller-connect-readiness.js";
import { resolveLegalEntityNotificationRecipients } from "../legal-entity-notification-routing.js";
import { assertLotMovableOnAtg } from "../sale-channel-guards.js";
import { recordLifecycle, txLot } from "./lot-mutation-context.js";
import { CANCELLABLE, type LotServiceDeps } from "./lot-types.js";

export async function publishLot(
  deps: LotServiceDeps,
  _userId: string,
  userRole: string,
  lotId: string,
  userStaffRoles?: StaffRoles | undefined,
): Promise<Result<Lot, LotError | AuthzError>> {
  const role = normalizeUserRoleOrClient(userRole);
  const staff = userStaffRoles;
  if (!canManageCatalogue(role, staff)) {
    return err(
      missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can publish lots",
        role,
        staff,
      ),
    );
  }
  const a = await deps.lotRepo.findById(lotId);
  if (!a) return err(new LotError("Lot not found", 404));

  let saleForPublish: Sale | null = null;
  if (a.saleId) {
    if (!deps.saleRepo) {
      return err(new LotError("Sale repository not configured", 500));
    }
    const sale = await deps.saleRepo.findById(a.saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    saleForPublish = sale;
  }

  const publishable = assertLotPublishable(a, { sale: saleForPublish, requireCatalogue: true });
  if (!publishable.ok) {
    return err(publishable.error);
  }
  const alignedPatch = publishable.timing.alignedPatch;
  if (deps.enforceIndividualConnectOnPublish && deps.legalEntityRepository) {
    const blocked = await findLotsMissingSellerConnect([a], deps.legalEntityRepository);
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
  let updated: Lot;
  if (deps.transactionRunner && deps.lotLifecycleRecording) {
    updated = await deps.transactionRunner.runInTransaction(async (tx) => {
      const lotRepo = txLot(deps, tx);
      if (alignedPatch) {
        await lotRepo.update(lotId, alignedPatch);
      }
      await lotRepo.updateStatus(lotId, "scheduled");
      const row = await lotRepo.findById(lotId);
      if (!row) throw new LotError("Lot not found", 404);
      await deps.lotLifecycleRecording?.recordPublished(tx, row, _userId);
      return row;
    });
  } else {
    if (alignedPatch) {
      await deps.lotRepo.update(lotId, alignedPatch);
    }
    await deps.lotRepo.updateStatus(lotId, "scheduled");
    const row = await deps.lotRepo.findById(lotId);
    if (!row) return err(new LotError("Lot not found", 404));
    updated = row;
    await recordLifecycle(deps, async (tx) => {
      await deps.lotLifecycleRecording?.recordPublished(tx, updated, _userId);
    });
  }
  const scheduleResult = await scheduleLotWithDraftRollback({
    jobScheduler: deps.jobScheduler,
    lotRepo: deps.lotRepo,
    lotLifecycleRecording: deps.lotLifecycleRecording,
    transactionRunner: deps.transactionRunner ?? null,
    repoFactory: deps.repoFactory ?? null,
    recordLotLifecycle: (fn) => recordLifecycle(deps, fn),
    lotId,
    startTime: updated.startTime,
    endTime: updated.endTime,
    actorUserId: _userId,
    unpublishReason: "manual",
  });
  if (scheduleResult.isErr()) return err(scheduleResult.error);
  return ok(updated);
}

export async function cancelLot(
  deps: LotServiceDeps,
  _userId: string,
  userRole: string,
  lotId: string,
  userStaffRoles?: StaffRoles | undefined,
  cancelReason: LotCancelledPayload["reason"] = "manual",
): Promise<Result<Lot, LotError | AuthzError>> {
  const a = await deps.lotRepo.findById(lotId);
  if (!a) return err(new LotError("Lot not found", 404));
  const role = normalizeUserRoleOrClient(userRole);
  const staff = userStaffRoles;
  if (!roleHasCapability(role, "auction.manage", staff)) {
    return err(new AuthzError("Only staff with auction.manage can cancel lots", 403));
  }
  if (!CANCELLABLE.has(a.status)) {
    return err(new LotError("This lot cannot be cancelled"));
  }
  const lotAtgConflict = await assertLotMovableOnAtg(deps.saleChannelReader, lotId, a.saleId);
  if (lotAtgConflict) return err(lotAtgConflict);
  let updated: Lot;
  if (deps.transactionRunner && deps.lotLifecycleRecording) {
    updated = await deps.transactionRunner.runInTransaction(async (tx) => {
      const lotRepo = txLot(deps, tx);
      await lotRepo.updateStatus(lotId, "cancelled");
      const row = await lotRepo.findById(lotId);
      if (!row) throw new LotError("Lot not found", 404);
      await deps.lotLifecycleRecording?.recordCancelled(tx, row, cancelReason, _userId);
      return row;
    });
  } else {
    await deps.lotRepo.updateStatus(lotId, "cancelled");
    const row = await deps.lotRepo.findById(lotId);
    if (!row) return err(new LotError("Lot not found", 404));
    updated = row;
    await recordLifecycle(deps, async (tx) => {
      await deps.lotLifecycleRecording?.recordCancelled(tx, updated, cancelReason, _userId);
    });
  }
  await deps.jobScheduler?.cancelLotJobs(lotId);

  if (updated.saleId && deps.telephoneBidBookingService) {
    await deps.telephoneBidBookingService.removeLotFromActiveBookings(updated.saleId, lotId);
  }

  if (deps.lotNotifications) {
    const bidders = await deps.bids.listDistinctBidderAccounts(lotId);
    const watchers = await deps.watchlist.listUserIdsForLot(lotId);
    const sellerRecipients = await resolveLegalEntityNotificationRecipients(
      deps.legalEntityNotificationRecipients,
      {
        legalEntityId: a.sellerLegalEntityId,
        fallbackUserId: _userId,
        audience: "seller",
      },
    );
    // Each person once: bidders about the account they bid for, the consignor about the
    // consigning account, and watchers personally.
    const accountOf = new Map<string, string | null>();
    for (const b of bidders) accountOf.set(b.userId, b.legalEntityId);
    for (const userId of sellerRecipients) {
      if (!accountOf.has(userId)) accountOf.set(userId, a.sellerLegalEntityId ?? null);
    }
    for (const userId of watchers) if (!accountOf.has(userId)) accountOf.set(userId, null);
    await deps.lotNotifications.notifyLotCancelled({
      lotId,
      title: a.title,
      recipients: [...accountOf].map(([userId, legalEntityId]) => ({ userId, legalEntityId })),
    });
  }

  return ok(updated);
}

export async function bulkPublishOrCancel(
  deps: LotServiceDeps,
  userId: string,
  userRole: string,
  ids: string[],
  op: "publish" | "cancel",
  userStaffRoles?: StaffRoles | undefined,
  reason?: string,
): Promise<
  Result<
    {
      attempted: number;
      failed: number;
      errors: Array<{ lotId: string; message: string; code?: string }>;
    },
    AuthzError
  >
> {
  const role = normalizeUserRoleOrClient(userRole);
  const staff = userStaffRoles;
  if (op === "cancel") {
    if (!roleHasCapability(role, "auction.manage", staff)) {
      return err(new AuthzError("Only staff with auction.manage can bulk cancel lots", 403));
    }
  } else if (!canManageCatalogue(role, staff)) {
    return err(
      missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can run bulk lot actions",
        role,
        staff,
      ),
    );
  }
  const errors: Array<{ lotId: string; message: string; code?: string }> = [];
  const cancelReason =
    op === "cancel" && reason?.trim() ? ("admin_override" as const) : ("manual" as const);
  for (const id of ids) {
    if (op === "publish") {
      const res = await publishLot(deps, userId, userRole, id, userStaffRoles);
      if (res.isErr()) {
        const error = res.error;
        errors.push({
          lotId: id,
          message: error.message,
          ...(error instanceof LotError && error.code ? { code: error.code } : {}),
        });
      }
    } else {
      const res = await cancelLot(deps, userId, userRole, id, userStaffRoles, cancelReason);
      if (res.isErr()) {
        const error = res.error;
        errors.push({
          lotId: id,
          message: error.message,
          ...(error instanceof LotError && error.code ? { code: error.code } : {}),
        });
      }
    }
  }
  return ok({ attempted: ids.length, failed: errors.length, errors });
}
