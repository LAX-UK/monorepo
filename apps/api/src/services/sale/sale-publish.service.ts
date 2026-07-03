import type { Lot, Sale, UserRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import {
  getSaleModeCapabilities,
  isOnsiteLocationPopulated,
  isStartInFutureForPublish,
} from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../../lib/errors.js";
import { assertLotPublishable } from "../../lib/lot-publish-policy.js";
import { resolveLotTimingForSale } from "../../lib/lot-sale-timing.js";
import {
  rollbackSalePublishOnScheduleFailure,
  scheduleJobsFailedError,
} from "../../lib/lot-schedule-jobs.js";
import { findLotsMissingSellerConnect } from "../../lib/seller-connect-readiness.js";
import type { ISalePublishService } from "../interfaces/sale-publish.js";
import {
  publishSaleEvent,
  recordLotLifecycle,
  scheduleRollbackDeps,
  txRepos,
} from "./sale-mutation-context.js";
import { getByIdWithLots } from "./sale-read.js";
import { SALE_CANCELLABLE } from "./sale-status-policy.js";
import type { SaleServiceDeps } from "./sale-types.js";
import { applyVenueSnapshot } from "./venue-snapshot.js";

export class SalePublishService implements ISalePublishService {
  constructor(private readonly deps: SaleServiceDeps) {}

  async publish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can publish sales", 403));
    }
    const bundle = await getByIdWithLots(this.deps, saleId);
    if (!bundle) return err(new LotError("Sale not found", 404));
    let { sale, lots } = bundle;
    if (sale.status !== "draft") {
      return err(new LotError("Only draft sales can be published"));
    }
    if (!isStartInFutureForPublish(sale.startTime)) {
      return err(new LotError("startTime must be in the future to publish"));
    }
    if (lots.length === 0) {
      return err(new LotError("Sale must have at least one lot to publish"));
    }
    const caps = getSaleModeCapabilities(sale.deliveryMode);
    if (caps.allowsLocation && sale.venueId) {
      const saleLegalEntityId =
        sale.createdByLegalEntityId ?? (await this.deps.resolvePlatformCatalogLegalEntityId());
      if (!saleLegalEntityId) {
        return err(new LotError("Sale legal entity is not configured", 400));
      }
      const snapshot = await applyVenueSnapshot(
        this.deps.venueRepository,
        { venueId: sale.venueId },
        {
          saleLegalEntityId,
          existingVenueId: sale.venueId,
          snapshotAddress: true,
        },
      );
      if (snapshot.isErr()) return err(snapshot.error);
      sale = await this.deps.saleRepo.update(saleId, snapshot.value);
      lots = await this.deps.lotRepo.findBySaleId(saleId);
    }
    if (caps.allowsLocation && !isOnsiteLocationPopulated(sale)) {
      return err(
        new LotError(
          "Onsite sales require a saved venue or venue name with address before publish",
          400,
          "onsite_location_required",
        ),
      );
    }
    for (const l of lots) {
      if (l.status !== "draft") {
        return err(new LotError("All lots in the sale must be draft to publish"));
      }
      const publishable = assertLotPublishable(l, {
        sale,
        requireCatalogue: true,
        rejectDraftSale: false,
      });
      if (!publishable.ok) {
        const error = publishable.error;
        return err(new LotError(`${error.message} (lot "${l.title}")`, error.status, error.code));
      }
    }

    if (this.deps.enforceIndividualConnectOnPublish && this.deps.legalEntityRepository) {
      const blocked = await findLotsMissingSellerConnect(lots, this.deps.legalEntityRepository);
      if (blocked.length > 0) {
        const titles = blocked.map((l) => `"${l.title}"`).join(", ");
        return err(
          new LotError(
            blocked.length === 1
              ? `This seller must complete Stripe Connect onboarding before the lot can be scheduled. (lot ${titles})`
              : `Sellers must complete Stripe Connect onboarding before publish (${blocked.length} lots: ${titles})`,
            409,
            "connect_required",
          ),
        );
      }
    }

    if (this.deps.transactionRunner && this.deps.lotLifecycleRecording) {
      await this.deps.transactionRunner.runInTransaction(async (tx) => {
        const saleRepo = txRepos(this.deps, tx).sale;
        const lotRepo = txRepos(this.deps, tx).lot;
        if (caps.inheritsLotTiming) {
          for (const l of lots) {
            const resolved = resolveLotTimingForSale(sale, l.startTime, l.endTime);
            if (
              resolved.ok &&
              (resolved.startTime.getTime() !== l.startTime.getTime() ||
                resolved.endTime.getTime() !== l.endTime.getTime())
            ) {
              await lotRepo.update(l.id, {
                startTime: resolved.startTime,
                endTime: resolved.endTime,
              });
            }
          }
        }
        await saleRepo.updateStatus(saleId, "scheduled");
        for (const l of lots) {
          await lotRepo.updateStatus(l.id, "scheduled");
          const row = await lotRepo.findById(l.id);
          if (!row) throw new LotError("Lot not found", 404);
          await this.deps.lotLifecycleRecording?.recordPublished(tx, row, userId);
        }
      });
    } else {
      if (caps.inheritsLotTiming) {
        for (const l of lots) {
          const resolved = resolveLotTimingForSale(sale, l.startTime, l.endTime);
          if (
            resolved.ok &&
            (resolved.startTime.getTime() !== l.startTime.getTime() ||
              resolved.endTime.getTime() !== l.endTime.getTime())
          ) {
            await this.deps.lotRepo.update(l.id, {
              startTime: resolved.startTime,
              endTime: resolved.endTime,
            });
          }
        }
      }
      await this.deps.saleRepo.updateStatus(saleId, "scheduled");
      for (const l of lots) {
        await this.deps.lotRepo.updateStatus(l.id, "scheduled");
        await recordLotLifecycle(this.deps, async (tx) => {
          await this.deps.lotLifecycleRecording?.recordPublished(
            tx,
            { ...l, status: "scheduled" },
            userId,
          );
        });
      }
    }
    const scheduledLotIds: string[] = [];
    for (const l of lots) {
      const lotStart = caps.inheritsLotTiming ? sale.startTime : l.startTime;
      const lotEnd = caps.inheritsLotTiming ? sale.endTime : l.endTime;
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
