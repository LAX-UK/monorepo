import type { Lot, Sale, UserRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../../lib/errors.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { ILotJobScheduler } from "../interfaces/job-scheduler.js";
import type { ILotSoftDeleteSideEffects } from "../interfaces/lot-soft-delete.js";
import type { ISaleSoftDeleteSideEffects } from "../interfaces/sale-soft-delete.js";
import { type LotSoftDeleteContext, validateLotSoftDelete } from "../lot-soft-delete.policy.js";
import { type SaleSoftDeleteContext, validateSaleSoftDelete } from "../sale-soft-delete.policy.js";

export class CatalogSoftDeleteOrchestrator {
  constructor(
    private readonly jobScheduler: ILotJobScheduler | null,
    private readonly domainEventSink: IDomainEventSink | null,
  ) {}

  assertAuctionManageCapability(
    userRole: string,
    deniedMessage: string,
    userStaffRole?: string | null,
  ): Result<void, AuthzError> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError(deniedMessage, 403));
    }
    return ok(undefined);
  }

  async executeLotSoftDelete(
    actorUserId: string,
    lot: Lot,
    sideEffects: ILotSoftDeleteSideEffects,
    ctx?: LotSoftDeleteContext,
    resolvedCtx?: LotSoftDeleteContext,
  ): Promise<Result<void, LotError>> {
    const context = ctx ?? resolvedCtx;
    if (!context) {
      return err(new LotError("Lot soft delete context required", 500));
    }

    const validation = validateLotSoftDelete(context);
    if (validation.isErr()) return err(validation.error);

    await this.jobScheduler?.cancelLotJobs(lot.id);

    const deletedAt = new Date();
    try {
      await sideEffects.softDeleteLot({ lotId: lot.id, actorUserId, deletedAt });
    } catch (error) {
      if (error instanceof LotError) return err(error);
      throw error;
    }

    await this.publishLotSoftDeleted(actorUserId, lot, deletedAt);

    return ok(undefined);
  }

  async executeSaleSoftDelete(
    actorUserId: string,
    sale: Sale,
    sideEffects: ISaleSoftDeleteSideEffects,
    ctx?: SaleSoftDeleteContext,
    resolvedCtx?: SaleSoftDeleteContext,
  ): Promise<Result<void, LotError>> {
    const context = ctx ?? resolvedCtx;
    if (!context) {
      return err(new LotError("Sale soft delete context required", 500));
    }

    const validation = validateSaleSoftDelete(context);
    if (validation.isErr()) return err(validation.error);

    for (const l of context.lots) {
      await this.jobScheduler?.cancelLotJobs(l.id);
    }

    const deletedAt = new Date();
    const lotIds = context.lots.map((l) => l.id);
    try {
      await sideEffects.softDeleteCascade({
        saleId: sale.id,
        actorUserId,
        deletedAt,
        lotIds,
      });
    } catch (error) {
      if (error instanceof LotError) return err(error);
      throw error;
    }

    await this.publishSaleSoftDeleted(actorUserId, sale, context.lots.length, deletedAt);

    return ok(undefined);
  }

  private async publishLotSoftDeleted(
    actorUserId: string,
    lot: Lot,
    deletedAt: Date,
  ): Promise<void> {
    if (!this.domainEventSink) return;
    await this.domainEventSink.publish({
      aggregateType: "lot",
      aggregateId: lot.id,
      eventType: "lot.soft_deleted",
      payload: {
        title: lot.title,
        from_status: lot.status,
        saleId: lot.saleId,
        deleted_at: deletedAt.toISOString(),
      },
      actorUserId,
    });
  }

  private async publishSaleSoftDeleted(
    actorUserId: string,
    sale: Sale,
    lotCount: number,
    deletedAt: Date,
  ): Promise<void> {
    if (!this.domainEventSink) return;
    await this.domainEventSink.publish({
      aggregateType: "sale",
      aggregateId: sale.id,
      eventType: "sale.soft_deleted",
      payload: {
        title: sale.title,
        from_status: sale.status,
        lotCount,
        deleted_at: deletedAt.toISOString(),
      },
      actorUserId,
    });
  }
}
