import { adminReviewTask } from "@auction/db/schema";
import type { Lot, UserRole } from "@auction/types";
import {
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { and, eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../../lib/errors.js";
import { cancelLot } from "./lot-lifecycle.js";
import { CANCELLABLE, type LotServiceDeps, SELLER_WITHDRAW_ROLES } from "./lot-types.js";

export async function requestWithdrawal(
  deps: LotServiceDeps,
  sellerUserId: string,
  lotId: string,
): Promise<Result<{ taskId: string; alreadyPending: boolean }, LotError | AuthzError>> {
  const db = deps.db;
  const publisher = deps.domainEventPublisher;
  const legalEntityRepository = deps.legalEntityRepository;
  if (!db || !legalEntityRepository || (!deps.lotLifecycleRecording && !publisher)) {
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

  const existing = await db
    .select({ id: adminReviewTask.id })
    .from(adminReviewTask)
    .where(
      and(
        eq(adminReviewTask.targetLotId, lotId),
        eq(adminReviewTask.kind, "lot_withdrawal_request"),
        eq(adminReviewTask.status, "pending"),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return ok({ taskId: existing[0].id, alreadyPending: true });
  }

  const taskId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(adminReviewTask)
      .values({
        kind: "lot_withdrawal_request",
        status: "pending",
        targetLotId: lotId,
        payload: { requestedByUserId: sellerUserId },
      })
      .returning({ id: adminReviewTask.id });
    if (!row) throw new Error("admin_review_task_insert_failed");
    if (deps.lotLifecycleRecording) {
      await deps.lotLifecycleRecording.recordWithdrawalRequested(
        tx,
        lotRow,
        sellerLegalEntityId,
        sellerUserId,
      );
    } else if (publisher) {
      await publisher.publish(tx, {
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
  if (!deps.db) {
    return err(new LotError("Withdrawal approvals are not available", 503));
  }
  const role = normalizeUserRoleOrClient(adminRole);
  const staff = normalizeUserStaffRole(adminStaffRole ?? undefined);
  if (!roleHasCapability(role, "auction.manage", staff)) {
    return err(new AuthzError("Only staff with auction.manage can approve withdrawals", 403));
  }
  const pending = await deps.db
    .select({ id: adminReviewTask.id })
    .from(adminReviewTask)
    .where(
      and(
        eq(adminReviewTask.targetLotId, lotId),
        eq(adminReviewTask.kind, "lot_withdrawal_request"),
        eq(adminReviewTask.status, "pending"),
      ),
    )
    .limit(1);
  if (!pending[0]) {
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
  await deps.db
    .update(adminReviewTask)
    .set({
      status: "resolved",
      resolvedByUserId: adminUserId,
      resolvedAt: new Date(),
      resolutionNotes: "Seller withdrawal approved; lot cancelled.",
    })
    .where(eq(adminReviewTask.id, pending[0].id));
  return cancelRes;
}
