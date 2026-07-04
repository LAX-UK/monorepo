import type { Lot, UserRole } from "@auction/types";
import {
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../../lib/errors.js";
import { cancelLot } from "./lot-lifecycle.js";
import { CANCELLABLE, type LotServiceDeps, SELLER_WITHDRAW_ROLES } from "./lot-types.js";

export async function requestWithdrawal(
  deps: LotServiceDeps,
  sellerUserId: string,
  lotId: string,
): Promise<Result<{ taskId: string; alreadyPending: boolean }, LotError | AuthzError>> {
  const publisher = deps.domainEventSink;
  const legalEntityRepository = deps.legalEntityRepository;
  const adminReviewTaskRepository = deps.adminReviewTaskRepository;
  if (
    !adminReviewTaskRepository ||
    !legalEntityRepository ||
    (!deps.lotLifecycleRecording && !publisher)
  ) {
    return err(new LotError("Withdrawal requests are not available", 503));
  }
  const lotRow = await deps.lotRepo.findById(lotId);
  if (!lotRow) return err(new LotError("Lot not found", 404));
  if (!lotRow.sellerLegalEntityId) {
    return err(new LotError("Lot has no seller organisation", 400));
  }
  const sellerLegalEntityId = lotRow.sellerLegalEntityId;
  if (!CANCELLABLE.has(lotRow.status)) {
    return err(new LotError("This lot cannot be withdrawn in its current state", 409));
  }
  const membership = await legalEntityRepository.findActiveMembership(
    sellerUserId,
    sellerLegalEntityId,
  );
  if (!membership || !SELLER_WITHDRAW_ROLES.has(membership.role)) {
    return err(new AuthzError("Only seller organisation admins can request withdrawal", 403));
  }

  const existing = await adminReviewTaskRepository.findPendingLotWithdrawal(lotId);
  if (existing) {
    return ok({ taskId: existing.id, alreadyPending: true });
  }

  if (!deps.transactionRunner) {
    return err(new LotError("Withdrawal requests are not available", 503));
  }

  const taskId = await deps.transactionRunner.runInTransaction(async (tx) => {
    const taskRepo = adminReviewTaskRepository.forConnection(tx);
    const row = await taskRepo.createLotWithdrawalRequest({
      lotId,
      requestedByUserId: sellerUserId,
    });
    if (deps.lotLifecycleRecording) {
      await deps.lotLifecycleRecording.recordWithdrawalRequested(
        tx,
        lotRow,
        sellerLegalEntityId,
        sellerUserId,
      );
    } else if (publisher) {
      await publisher.withTx(tx).publish({
        aggregateType: "lot",
        aggregateId: lotId,
        eventType: "lot.withdrawal_requested",
        payload: { sellerLegalEntityId: sellerLegalEntityId },
        actorUserId: sellerUserId,
        actingLegalEntityId: sellerLegalEntityId,
      });
    }
    return row.id;
  });

  return ok({ taskId, alreadyPending: false });
}

export async function approveWithdrawalRequest(
  deps: LotServiceDeps,
  adminUserId: string,
  adminRole: UserRole,
  lotId: string,
  adminStaffRole?: string | null,
): Promise<Result<Lot, LotError | AuthzError>> {
  const adminReviewTaskRepository = deps.adminReviewTaskRepository;
  if (!adminReviewTaskRepository) {
    return err(new LotError("Withdrawal approvals are not available", 503));
  }
  const role = normalizeUserRoleOrClient(adminRole);
  const staff = normalizeUserStaffRole(adminStaffRole ?? undefined);
  if (!roleHasCapability(role, "auction.manage", staff)) {
    return err(new AuthzError("Only staff with auction.manage can approve withdrawals", 403));
  }
  const pending = await adminReviewTaskRepository.findPendingLotWithdrawal(lotId);
  if (!pending) {
    return err(new LotError("No pending withdrawal request for this lot", 404));
  }
  const cancelRes = await cancelLot(
    deps,
    adminUserId,
    adminRole,
    lotId,
    adminStaffRole,
    "withdrawal",
  );
  if (cancelRes.isErr()) return cancelRes;
  await adminReviewTaskRepository.resolveLotWithdrawal({
    taskId: pending.id,
    resolvedByUserId: adminUserId,
    resolutionNotes: "Seller withdrawal approved; lot cancelled.",
  });
  return cancelRes;
}
