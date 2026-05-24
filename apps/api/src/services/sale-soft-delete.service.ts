import type { Database } from "@auction/db";
import {
  type Sale,
  type UserRole,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { saleDeleteConfirmationPhrase } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type {
  ISaleSoftDeleteSideEffects,
  SaleSoftDeleteGuardCounts,
} from "./interfaces/sale-soft-delete.js";
import {
  type SaleSoftDeleteContext,
  canSaleSoftDelete,
  listSaleSoftDeleteBlockers,
  validateSaleSoftDelete,
} from "./sale-soft-delete.policy.js";

export type SaleDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  guards: SaleSoftDeleteGuardCounts;
  blockers: string[];
};

export class SaleSoftDeleteService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly sideEffects: ISaleSoftDeleteSideEffects,
    private readonly jobScheduler: ILotJobScheduler | null,
    private readonly db: Database | null,
    private readonly domainEventPublisher: DomainEventPublisher | null,
  ) {}

  async getDeleteEligibility(saleId: string): Promise<SaleDeleteEligibility | null> {
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return null;

    const lots = await this.lotRepo.findBySaleId(saleId);
    const guards = await this.sideEffects.countGuardsForSale(saleId);
    const ctx: SaleSoftDeleteContext = { sale, lots, guards };
    const blockers = listSaleSoftDeleteBlockers(ctx);
    const canDelete = canSaleSoftDelete(ctx);

    return {
      canDelete,
      confirmationPhrase: canDelete ? saleDeleteConfirmationPhrase(sale.title) : null,
      guards,
      blockers,
    };
  }

  async softDelete(
    actorUserId: string,
    userRole: string,
    saleId: string,
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
      return err(new AuthzError("Only staff with auction.manage can delete sales", 403));
    }

    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));

    const expected = saleDeleteConfirmationPhrase(sale.title);
    if (confirmationPhrase !== expected) {
      return err(new LotError(`Type exactly: ${expected}`, 400));
    }

    const lots = await this.lotRepo.findBySaleId(saleId);
    const guards = await this.sideEffects.countGuardsForSale(saleId);

    const ctx: SaleSoftDeleteContext = { sale, lots, guards };
    const validation = validateSaleSoftDelete(ctx);
    if (validation.isErr()) return err(validation.error);

    for (const l of lots) {
      await this.jobScheduler?.cancelLotJobs(l.id);
    }

    const deletedAt = new Date();
    const lotIds = lots.map((l) => l.id);
    await this.sideEffects.softDeleteCascade({
      saleId,
      actorUserId,
      deletedAt,
      lotIds,
    });

    await this.publishEvent(actorUserId, sale, lots.length, deletedAt);

    return ok(undefined);
  }

  private async publishEvent(
    actorUserId: string,
    sale: Sale,
    lotCount: number,
    deletedAt: Date,
  ): Promise<void> {
    if (!this.db || !this.domainEventPublisher) return;
    await this.domainEventPublisher.publish(this.db, {
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
