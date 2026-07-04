import type { Lot, Sale, UserRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../../lib/errors.js";
import {
  rollbackSalePublishOnScheduleFailure,
  scheduleJobsFailedError,
} from "../../lib/lot-schedule-jobs.js";
import type { ISalePublishService } from "../interfaces/sale-publish.js";
import {
  publishSaleEvent,
  recordLotLifecycle,
  scheduleRollbackDeps,
  txRepos,
} from "./sale-mutation-context.js";
import {
  applyVenueSnapshotForPublish,
  assertCanPublishSale,
  lotScheduleWindowForPublish,
  scheduleSaleLotsForPublish,
  validatePublishReadiness,
} from "./sale-publish.pipeline.js";
import { SALE_CANCELLABLE } from "./sale-status-policy.js";
import type { SaleServiceDeps } from "./sale-types.js";

export class SalePublishService implements ISalePublishService {
  constructor(private readonly deps: SaleServiceDeps) {}

  async publish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>> {
    const authz = await assertCanPublishSale(userRole, userStaffRole);
    if (authz.isErr()) return err(authz.error);

    const readiness = await validatePublishReadiness(this.deps, saleId);
    if (readiness.isErr()) return err(readiness.error);

    const withVenue = await applyVenueSnapshotForPublish(this.deps, saleId, readiness.value);
    if (withVenue.isErr()) return err(withVenue.error);

    const { lots } = withVenue.value;
    await scheduleSaleLotsForPublish(this.deps, saleId, userId, withVenue.value);

    const scheduledLotIds: string[] = [];
    for (const l of lots) {
      const { lotStart, lotEnd } = lotScheduleWindowForPublish(withVenue.value, l);
      try {
        await this.deps.jobScheduler?.scheduleLot(l.id, lotStart, lotEnd);
        scheduledLotIds.push(l.id);
      } catch {
        await rollbackSalePublishOnScheduleFailure({
          ...scheduleRollbackDeps(this.deps),
          saleRepo: this.deps.saleRepo,
          saleId,
          lots,
          scheduledLotIds,
          actorUserId: userId,
        });
        return err(scheduleJobsFailedError());
      }
    }
    const updatedSale = await this.deps.saleRepo.findById(saleId);
    if (!updatedSale) return err(new LotError("Sale not found", 404));
    const updatedLots = await this.deps.lotRepo.findBySaleId(saleId);
    await publishSaleEvent(this.deps, userId, saleId, "sale.published", {
      from_status: "draft",
      to_status: "scheduled",
      lotCount: updatedLots.length,
      deliveryMode: updatedSale.deliveryMode,
    });
    return ok({ sale: updatedSale, lots: updatedLots });
  }

  /** Revert a scheduled sale (and its scheduled lots) back to draft. */
  async unpublish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can unpublish sales", 403));
    }
    const sale = await this.deps.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (sale.status !== "scheduled") {
      return err(
        new LotError("Only scheduled sales can be reverted to draft (no active or ended sales)"),
      );
    }
    const lots = await this.deps.lotRepo.findBySaleId(saleId);
    const hasStartedLot = lots.some((l) => l.status !== "scheduled" && l.status !== "draft");
    if (hasStartedLot) {
      return err(
        new LotError(
          "Cannot revert to draft: at least one lot is active, ended, or cancelled. Cancel the sale instead.",
        ),
      );
    }
    for (const l of lots) {
      await this.deps.jobScheduler?.cancelLotJobs(l.id);
    }
    if (this.deps.transactionRunner && this.deps.lotLifecycleRecording) {
      await this.deps.transactionRunner.runInTransaction(async (tx) => {
        const lotRepo = txRepos(this.deps, tx).lot;
        const saleRepo = txRepos(this.deps, tx).sale;
        for (const l of lots) {
          await lotRepo.updateStatus(l.id, "draft");
          const row = await lotRepo.findById(l.id);
          if (!row) throw new LotError("Lot not found", 404);
          await this.deps.lotLifecycleRecording?.recordUnpublished(
            tx,
            row,
            "sale_unpublish",
            userId,
          );
        }
        await saleRepo.updateStatus(saleId, "draft");
      });
    } else {
      for (const l of lots) {
        await this.deps.lotRepo.updateStatus(l.id, "draft");
        await recordLotLifecycle(this.deps, async (tx) => {
          await this.deps.lotLifecycleRecording?.recordUnpublished(tx, l, "sale_unpublish", userId);
        });
      }
      await this.deps.saleRepo.updateStatus(saleId, "draft");
    }
    const updated = await this.deps.saleRepo.findById(saleId);
    if (!updated) return err(new LotError("Sale not found", 404));
    await publishSaleEvent(this.deps, userId, saleId, "sale.unpublished", {
      from_status: "scheduled",
      to_status: "draft",
    });
    return ok(updated);
  }

  async cancel(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can cancel sales", 403));
    }
    const sale = await this.deps.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (!SALE_CANCELLABLE.has(sale.status)) {
      return err(new LotError("This sale cannot be cancelled"));
    }
    const lots = await this.deps.lotRepo.findBySaleId(saleId);
    for (const l of lots) {
      if (l.status === "draft" || l.status === "scheduled" || l.status === "active") {
        await this.deps.jobScheduler?.cancelLotJobs(l.id);
      }
    }
    if (this.deps.transactionRunner && this.deps.lotLifecycleRecording) {
      await this.deps.transactionRunner.runInTransaction(async (tx) => {
        const lotRepo = txRepos(this.deps, tx).lot;
        const saleRepo = txRepos(this.deps, tx).sale;
        for (const l of lots) {
          if (l.status === "draft" || l.status === "scheduled" || l.status === "active") {
            await lotRepo.updateStatus(l.id, "cancelled");
            const row = await lotRepo.findById(l.id);
            if (!row) throw new LotError("Lot not found", 404);
            await this.deps.lotLifecycleRecording?.recordCancelled(tx, row, "sale_cancel", userId);
          }
        }
        await saleRepo.updateStatus(saleId, "cancelled");
      });
    } else {
      for (const l of lots) {
        if (l.status === "draft" || l.status === "scheduled" || l.status === "active") {
          await this.deps.lotRepo.updateStatus(l.id, "cancelled");
          await recordLotLifecycle(this.deps, async (tx) => {
            await this.deps.lotLifecycleRecording?.recordCancelled(
              tx,
              { ...l, status: "cancelled" },
              "sale_cancel",
              userId,
            );
          });
        }
      }
      await this.deps.saleRepo.updateStatus(saleId, "cancelled");
    }
    const updated = await this.deps.saleRepo.findById(saleId);
    if (!updated) return err(new LotError("Sale not found", 404));
    await publishSaleEvent(this.deps, userId, saleId, "sale.cancelled", {
      from_status: sale.status,
      to_status: "cancelled",
      lotCount: lots.length,
    });
    return ok(updated);
  }
}
