import type { Database } from "@auction/db";
import { type Lot, type UserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { lotDeleteConfirmationPhrase } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotSoftDeleteSideEffects } from "./interfaces/lot-soft-delete.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import {
  type LotSoftDeleteContext,
  canLotSoftDelete,
  listLotSoftDeleteBlockers,
  validateLotSoftDelete,
} from "./lot-soft-delete.policy.js";

export type LotDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  blockers: string[];
};

export class LotSoftDeleteService {
  constructor(
    private readonly lotRepo: ILotRepository,
    private readonly saleRepo: ISaleRepository,
    private readonly sideEffects: ILotSoftDeleteSideEffects,
    private readonly jobScheduler: ILotJobScheduler | null,
    private readonly db: Database | null,
    private readonly domainEventPublisher: DomainEventPublisher | null,
  ) {}

  async getDeleteEligibility(lotId: string): Promise<LotDeleteEligibility | null> {
    const lot = await this.lotRepo.findById(lotId);
    if (!lot) return null;

    const sale = lot.saleId ? await this.saleRepo.findById(lot.saleId) : null;
    const guards = await this.sideEffects.countGuardsForLot(lotId, lot.saleId);
    const ctx: LotSoftDeleteContext = { lot, sale, guards };
    const blockers = listLotSoftDeleteBlockers(ctx);
    const canDelete = canLotSoftDelete(ctx);

    return {
      canDelete,
      confirmationPhrase: canDelete ? lotDeleteConfirmationPhrase(lot.title) : null,
      blockers,
    };
  }

  async softDelete(
    actorUserId: string,
    userRole: string,
    lotId: string,
    confirmationPhrase: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can delete lots", 403));
    }

    const lot = await this.lotRepo.findById(lotId);
    if (!lot) return err(new LotError("Lot not found", 404));

    const expected = lotDeleteConfirmationPhrase(lot.title);
    if (confirmationPhrase !== expected) {
      return err(new LotError(`Type exactly: ${expected}`, 400));
    }

    const sale = lot.saleId ? await this.saleRepo.findById(lot.saleId) : null;
    const guards = await this.sideEffects.countGuardsForLot(lotId, lot.saleId);
    const ctx: LotSoftDeleteContext = { lot, sale, guards };
    const validation = validateLotSoftDelete(ctx);
    if (validation.isErr()) return err(validation.error);

    await this.jobScheduler?.cancelLotJobs(lotId);

    const deletedAt = new Date();
    try {
      await this.sideEffects.softDeleteLot({ lotId, actorUserId, deletedAt });
    } catch (error) {
      if (error instanceof LotError) return err(error);
      throw error;
    }

    await this.publishEvent(actorUserId, lot, deletedAt);

    return ok(undefined);
  }

  private async publishEvent(actorUserId: string, lot: Lot, deletedAt: Date): Promise<void> {
    if (!this.db || !this.domainEventPublisher) return;
    await this.domainEventPublisher.publish(this.db, {
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
}
