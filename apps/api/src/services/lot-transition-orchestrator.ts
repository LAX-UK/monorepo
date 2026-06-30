import type { Database } from "@auction/db";
import { lot } from "@auction/db/schema";
import { canAdminOverrideLotStatus, canLotTransition } from "@auction/domain";
import type { Lot, LotStatus, UserRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository } from "./interfaces/repositories.js";
import type { LotLifecycleEventRecorder } from "./lot-lifecycle-event-recorder.js";
import {
  LotLifecycleRecording,
  resetLotForInventoryReturn,
} from "./lot-lifecycle-recording.service.js";
import { LotTransitionGuards } from "./lot-transition-guards.js";

export type ReturnToInventoryInput = {
  reason: string;
  confirmVoided?: boolean;
  notifyBidders?: boolean;
};

export class LotTransitionOrchestrator {
  private readonly recording: LotLifecycleRecording;
  private readonly guards: LotTransitionGuards;

  constructor(
    private readonly db: Database,
    recorder: LotLifecycleEventRecorder,
    private readonly lotRepo: ILotRepository,
    private readonly jobScheduler: ILotJobScheduler | null,
  ) {
    this.recording = new LotLifecycleRecording(recorder);
    this.guards = new LotTransitionGuards(db);
  }

  get recordingService(): LotLifecycleRecording {
    return this.recording;
  }

  async returnToInventory(
    actorUserId: string,
    userRole: string,
    lotId: string,
    input: ReturnToInventoryInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(
        new AuthzError("Only staff with auction.manage can return lots to inventory", 403),
      );
    }

    const row = await this.lotRepo.findById(lotId);
    if (!row) return err(new LotError("Lot not found", 404));
    if (row.deletedAt) return err(new LotError("Lot not found", 404));

    if (!canLotTransition(row.status, "return_to_inventory")) {
      return err(new LotError("This lot cannot be returned to inventory in its current status"));
    }

    if (row.status === "ended" && row.winnerId) {
      return err(new LotError("Sold lots cannot be returned to inventory"));
    }

    if (row.status === "voided" && !input.confirmVoided) {
      return err(
        new LotError(
          "Confirm anti-shilling review is complete before returning a voided lot to inventory",
          422,
          "confirm_voided_required",
        ),
      );
    }

    if (row.archivedSeller) {
      return err(
        new LotError(
          "Seller is archived — unarchive the seller or reassign the lot before returning to inventory",
          422,
        ),
      );
    }

    const guardMsg = await this.guards.assertReturnToInventoryAllowed(lotId);
    if (guardMsg) return err(new LotError(guardMsg, 422));

    const fromStatus = row.status as "ended" | "cancelled" | "voided";
    const lastSaleId = row.saleId;

    await this.db.transaction(async (tx) => {
      await resetLotForInventoryReturn(tx, lotId, fromStatus);
      await this.recording.recordReturnedToInventory(
        tx,
        row,
        {
          fromStatus,
          lastSaleId,
          reason: input.reason,
        },
        actorUserId,
      );
    });

    await this.jobScheduler?.cancelLotJobs(lotId);

    const updated = await this.lotRepo.findById(lotId);
    if (!updated) return err(new LotError("Lot not found", 404));
    return ok(updated);
  }

  assertAdminOverride(from: LotStatus, to: LotStatus): LotError | null {
    if (!canAdminOverrideLotStatus(from, to)) {
      return new LotError(`Cannot move lot from ${from} to ${to} via admin override`);
    }
    return null;
  }

  async findLotRow(lotId: string): Promise<Lot | null> {
    return this.lotRepo.findById(lotId);
  }

  async findLotForUpdate(tx: Database, lotId: string) {
    const [row] = await tx.select().from(lot).where(eq(lot.id, lotId)).limit(1);
    return row ?? null;
  }
}
