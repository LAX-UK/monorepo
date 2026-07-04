import type { Database } from "@auction/db";
import { canAdminOverrideLotStatus } from "@auction/domain";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { Lot, LotStatus, UserRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import { assertLotPublishable } from "../lib/lot-publish-policy.js";
import { scheduleLotWithDraftRollback } from "../lib/lot-schedule-jobs.js";
import { findLotsMissingSellerConnect } from "../lib/seller-connect-readiness.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "./interfaces/lot-lifecycle-recorder.js";
import type { ILotStatusAdminService } from "./interfaces/lot-status-admin.js";

export class LotStatusAdminService implements ILotStatusAdminService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly jobScheduler: ILotJobScheduler | null,
    private readonly transactionRunner: ITransactionRunner | null = null,
    private readonly lotLifecycleRecording: ILotLifecycleRecorder | null = null,
    private readonly legalEntityRepository: ILegalEntityRepository | null = null,
    private readonly enforceIndividualConnectOnPublish = false,
    private readonly repoFactory: IRepositoryFactory | null = null,
  ) {}

  private txRepos(tx: Database) {
    if (!this.repoFactory) {
      throw new Error("lot_status_admin_repo_factory_required");
    }
    return this.repoFactory.forTransaction(tx);
  }

  private async recordLot(fn: (tx: Database) => Promise<void>): Promise<void> {
    if (!this.transactionRunner || !this.lotLifecycleRecording) return;
    await this.transactionRunner.runInTransaction(fn);
  }

  async setLotStatus(
    userRole: string,
    saleId: string,
    lotId: string,
    status: LotStatus,
    _reason?: string,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can change lot status", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    const l = await this.lotRepo.findById(lotId);
    if (!l || l.saleId !== saleId) {
      return err(new LotError("Lot not found in this sale", 404));
    }
    if (!canAdminOverrideLotStatus(l.status, status)) {
      return err(new LotError(`Cannot move lot from ${l.status} to ${status} via admin override`));
    }
    if (status === "draft") {
      return err(
        new LotError(
          "Use Return to inventory to move lots back to draft inventory",
          422,
          "use_return_to_inventory",
        ),
      );
    }
    if (status === "cancelled") {
      return err(
        new LotError(
          "Use POST /sales/:id/lots/:lotId/cancel to cancel lots with bidder notifications",
          422,
          "use_dedicated_cancel",
        ),
      );
    }
    if (status === "ended") {
      await this.jobScheduler?.cancelLotJobs(lotId);
    }
    let workingLot = l;
    if (status === "scheduled") {
      const publishable = assertLotPublishable(workingLot, {
        sale,
        requireCatalogue: false,
        rejectDraftSale: true,
      });
      if (!publishable.ok) {
        return err(publishable.error);
      }
      if (publishable.timing.alignedPatch) {
        await this.lotRepo.update(lotId, publishable.timing.alignedPatch);
        workingLot = {
          ...workingLot,
          startTime: publishable.timing.startTime,
          endTime: publishable.timing.endTime,
        };
      }
    }
    if (
      status === "scheduled" &&
      this.enforceIndividualConnectOnPublish &&
      this.legalEntityRepository
    ) {
      const blocked = await findLotsMissingSellerConnect([workingLot], this.legalEntityRepository);
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
    if (this.transactionRunner && this.lotLifecycleRecording) {
      updated = await this.transactionRunner.runInTransaction(async (tx) => {
        const lotRepo = this.txRepos(tx).lot;
        await lotRepo.updateStatus(lotId, status);
        const row = await lotRepo.findById(lotId);
        if (!row) throw new LotError("Lot not found", 404);
        if (status === "ended") {
          await this.lotLifecycleRecording?.recordEnded(tx, {
            lot: row,
            payload: {
              outcome: row.winnerId ? "sold" : "no_sale",
              winnerId: row.winnerId,
              saleId: row.saleId,
              trigger: "admin_override",
            },
          });
        } else if (status === "scheduled") {
          await this.lotLifecycleRecording?.recordPublished(tx, row);
        }
        return row;
      });
    } else {
      await this.lotRepo.updateStatus(lotId, status);
      const row = await this.lotRepo.findById(lotId);
      if (!row) return err(new LotError("Lot not found", 404));
      updated = row;
      await this.recordLot(async (tx) => {
        if (status === "ended") {
          await this.lotLifecycleRecording?.recordEnded(tx, {
            lot: updated,
            payload: {
              outcome: updated.winnerId ? "sold" : "no_sale",
              winnerId: updated.winnerId,
              saleId: updated.saleId,
              trigger: "admin_override",
            },
          });
        } else if (status === "scheduled") {
          await this.lotLifecycleRecording?.recordPublished(tx, updated);
        }
      });
    }
    if (status === "scheduled") {
      const scheduleResult = await scheduleLotWithDraftRollback({
        jobScheduler: this.jobScheduler,
        lotRepo: this.lotRepo,
        lotLifecycleRecording: this.lotLifecycleRecording,
        transactionRunner: this.transactionRunner,
        repoFactory: this.repoFactory,
        recordLotLifecycle: (fn) => this.recordLot(fn),
        lotId,
        startTime: updated.startTime,
        endTime: updated.endTime,
        unpublishReason: "manual",
      });
      if (scheduleResult.isErr()) return err(scheduleResult.error);
    }
    return ok(updated);
  }
}
