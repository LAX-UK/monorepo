import type { Database } from "@auction/db";
import {
  type Lot,
  type LotStatus,
  type Sale,
  type UserRole,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { saleModeAllowsBidding } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { canAdminOverrideLotStatus } from "../domain/lot-transitions.js";
import { AuthzError, LotError } from "../lib/errors.js";
import { assertLotPublishable } from "../lib/lot-publish-policy.js";
import { scheduleLotWithDraftRollback } from "../lib/lot-schedule-jobs.js";
import { findLotsMissingSellerConnect } from "../lib/seller-connect-readiness.js";
import { DrizzleLotRepository } from "../repositories/drizzle-lot.repository.js";
import { DrizzleSaleRepository } from "../repositories/drizzle-sale.repository.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type { ISaleStatusTransitionService } from "./interfaces/sale-status-transition.js";
import type { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";

/** Allowed admin overrides per current lot status. These intentionally do not
 * include moves back into `active` (admins should only be ending or cancelling).
 * @deprecated Use canAdminOverrideLotStatus from domain/lot-transitions.ts
 */
const ALLOWED_LOT_TRANSITIONS: Record<LotStatus, ReadonlySet<LotStatus>> = {
  draft: new Set(["scheduled", "cancelled"]),
  scheduled: new Set(["cancelled"]),
  active: new Set(["ended", "cancelled"]),
  ended: new Set(["draft"]),
  cancelled: new Set(["draft"]),
  voided: new Set(["draft"]),
};

export class SaleStatusTransitionService implements ISaleStatusTransitionService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly jobScheduler: ILotJobScheduler | null,
    private readonly db: Database | null = null,
    private readonly domainEventPublisher: DomainEventPublisher | null = null,
    private readonly lotLifecycleRecording: LotLifecycleRecording | null = null,
    private readonly legalEntityRepository: ILegalEntityRepository | null = null,
    private readonly enforceIndividualConnectOnPublish = false,
  ) {}

  private async recordLot(fn: (tx: Database) => Promise<void>): Promise<void> {
    if (!this.db || !this.lotLifecycleRecording) return;
    await this.db.transaction(fn);
  }

  async markOnsiteSaleEnded(
    userRole: string,
    saleId: string,
    reason?: string,
    userStaffRole?: string | null,
    actorUserId?: string | null,
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can change sale status", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (saleModeAllowsBidding(sale.deliveryMode)) {
      return err(
        new LotError("Only onsite sales can be ended manually; online sales end automatically"),
      );
    }
    if (sale.status !== "active" && sale.status !== "scheduled") {
      return err(new LotError("Only active or scheduled sales can be marked ended"));
    }

    const lots = await this.lotRepo.findBySaleId(saleId);
    const endingLots = lots.filter((l) => l.status === "scheduled" || l.status === "active");
    for (const l of endingLots) {
      await this.jobScheduler?.cancelLotJobs(l.id);
    }
    if (this.db && this.lotLifecycleRecording) {
      await this.db.transaction(async (tx) => {
        const lotRepo = new DrizzleLotRepository(tx);
        const saleRepo = new DrizzleSaleRepository(tx);
        for (const l of endingLots) {
          await lotRepo.updateStatus(l.id, "ended");
          const row = await lotRepo.findById(l.id);
          if (!row) throw new LotError("Lot not found", 404);
          await this.lotLifecycleRecording?.recordEnded(tx, {
            lot: row,
            payload: {
              outcome: l.winnerId ? "sold" : "no_sale",
              winnerId: l.winnerId,
              saleId: l.saleId,
              trigger: "onsite_sale_end",
            },
            actorUserId: actorUserId ?? null,
          });
        }
        await saleRepo.updateStatus(saleId, "ended");
        if (this.domainEventPublisher) {
          await this.domainEventPublisher.publish(tx, {
            aggregateType: "sale",
            aggregateId: saleId,
            eventType: "sale.ended",
            payload: {
              from_status: sale.status,
              to_status: "ended",
              ...(reason ? { reason } : {}),
            },
            actorUserId: actorUserId ?? null,
          });
        }
      });
    } else {
      for (const l of endingLots) {
        await this.lotRepo.updateStatus(l.id, "ended");
        await this.recordLot(async (tx) => {
          await this.lotLifecycleRecording?.recordEnded(tx, {
            lot: { ...l, status: "ended" },
            payload: {
              outcome: l.winnerId ? "sold" : "no_sale",
              winnerId: l.winnerId,
              saleId: l.saleId,
              trigger: "onsite_sale_end",
            },
            actorUserId: actorUserId ?? null,
          });
        });
      }
      await this.saleRepo.updateStatus(saleId, "ended");
      if (this.db && this.domainEventPublisher) {
        await this.domainEventPublisher.publish(this.db, {
          aggregateType: "sale",
          aggregateId: saleId,
          eventType: "sale.ended",
          payload: {
            from_status: sale.status,
            to_status: "ended",
            ...(reason ? { reason } : {}),
          },
          actorUserId: actorUserId ?? null,
        });
      }
    }

    const updatedSale = await this.saleRepo.findById(saleId);
    if (!updatedSale) return err(new LotError("Sale not found", 404));
    const updatedLots = await this.lotRepo.findBySaleId(saleId);
    return ok({ sale: updatedSale, lots: updatedLots });
  }

  /**
   * @deprecated No route callers — use {@link LotService.cancel} via POST .../cancel.
   */
  async cancelLot(
    userRole: string,
    saleId: string,
    lotId: string,
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
      return err(new AuthzError("Only staff with auction.manage can cancel lots", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    const l = await this.lotRepo.findById(lotId);
    if (!l || l.saleId !== saleId) {
      return err(new LotError("Lot not found in this sale", 404));
    }
    return err(
      new LotError(
        "Use POST /sales/:id/lots/:lotId/cancel to cancel lots with bidder notifications",
        422,
        "use_dedicated_cancel",
      ),
    );
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
    const allowed = ALLOWED_LOT_TRANSITIONS[l.status];
    if (!allowed.has(status) && !canAdminOverrideLotStatus(l.status, status)) {
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
    if (this.db && this.lotLifecycleRecording) {
      updated = await this.db.transaction(async (tx) => {
        const lotRepo = new DrizzleLotRepository(tx);
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
        db: this.db ?? null,
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
