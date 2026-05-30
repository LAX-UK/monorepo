import type { Database } from "@auction/db";
import {
  type Lot,
  type Sale,
  type UserRole,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import {
  bulkSaleDeleteConfirmationPhrase,
  saleDeleteConfirmationPhrase,
} from "@auction/validators";
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

export type SaleBulkSoftDeleteError = {
  saleId: string;
  message: string;
  blockers?: string[];
};

export type SaleBulkSoftDeleteResult = {
  attempted: number;
  failed: number;
  errors: SaleBulkSoftDeleteError[];
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

  async getDeleteEligibilityBatch(
    rows: Array<{ sale: Sale; lots: Lot[] }>,
  ): Promise<Map<string, SaleDeleteEligibility>> {
    const eligible = rows.filter((r) => r.sale.status === "draft" || r.sale.status === "scheduled");
    const result = new Map<string, SaleDeleteEligibility>();
    if (eligible.length === 0) return result;

    const saleIds = eligible.map((r) => r.sale.id);
    const guardsBySale = await this.sideEffects.countGuardsForSales(saleIds);

    for (const { sale, lots } of eligible) {
      const guards = guardsBySale.get(sale.id) ?? {
        bidCount: 0,
        paymentCount: 0,
        approvedRegistrationCount: 0,
      };
      const ctx: SaleSoftDeleteContext = { sale, lots, guards };
      const blockers = listSaleSoftDeleteBlockers(ctx);
      const canDelete = canSaleSoftDelete(ctx);
      result.set(sale.id, {
        canDelete,
        confirmationPhrase: canDelete ? saleDeleteConfirmationPhrase(sale.title) : null,
        guards,
        blockers,
      });
    }

    return result;
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

    return this.executeSoftDelete(actorUserId, sale);
  }

  async bulkSoftDelete(
    actorUserId: string,
    userRole: string,
    ids: string[],
    confirmationPhrase: string,
    userStaffRole?: string | null,
  ): Promise<Result<SaleBulkSoftDeleteResult, AuthzError | LotError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can delete sales", 403));
    }

    const expected = bulkSaleDeleteConfirmationPhrase(ids.length);
    if (confirmationPhrase !== expected) {
      return err(new LotError(`Type exactly: ${expected}`, 400));
    }

    const saleRows = await Promise.all(ids.map((id) => this.saleRepo.findById(id)));
    const salesFound = saleRows.filter((sale): sale is Sale => sale != null);
    const guardsBySale =
      salesFound.length > 0
        ? await this.sideEffects.countGuardsForSales(salesFound.map((s) => s.id))
        : new Map<string, SaleSoftDeleteGuardCounts>();
    const lotsBySaleCache = new Map<string, Lot[]>();

    const errors: SaleBulkSoftDeleteError[] = [];

    for (const [i, saleId] of ids.entries()) {
      const sale = saleRows[i];
      if (!sale) {
        errors.push({ saleId, message: "Sale not found" });
        continue;
      }

      let lots = lotsBySaleCache.get(saleId);
      if (!lots) {
        lots = await this.lotRepo.findBySaleId(saleId);
        lotsBySaleCache.set(saleId, lots);
      }
      const guards = guardsBySale.get(saleId) ?? {
        bidCount: 0,
        paymentCount: 0,
        approvedRegistrationCount: 0,
      };
      const ctx: SaleSoftDeleteContext = { sale, lots, guards };
      const blockers = listSaleSoftDeleteBlockers(ctx);
      if (!canSaleSoftDelete(ctx)) {
        errors.push({
          saleId,
          message: blockers[0] ?? "Sale cannot be deleted",
          ...(blockers.length > 0 ? { blockers } : {}),
        });
        continue;
      }

      const result = await this.executeSoftDelete(actorUserId, sale, ctx);
      if (result.isErr()) {
        errors.push({ saleId, message: result.error.message });
      }
    }

    return ok({
      attempted: ids.length,
      failed: errors.length,
      errors,
    });
  }

  private async executeSoftDelete(
    actorUserId: string,
    sale: Sale,
    ctx?: SaleSoftDeleteContext,
  ): Promise<Result<void, LotError>> {
    const resolvedCtx =
      ctx ??
      (await (async () => {
        const lots = await this.lotRepo.findBySaleId(sale.id);
        const guards = await this.sideEffects.countGuardsForSale(sale.id);
        return { sale, lots, guards };
      })());

    const validation = validateSaleSoftDelete(resolvedCtx);
    if (validation.isErr()) return err(validation.error);

    for (const l of resolvedCtx.lots) {
      await this.jobScheduler?.cancelLotJobs(l.id);
    }

    const deletedAt = new Date();
    const lotIds = resolvedCtx.lots.map((l) => l.id);
    try {
      await this.sideEffects.softDeleteCascade({
        saleId: sale.id,
        actorUserId,
        deletedAt,
        lotIds,
      });
    } catch (error) {
      if (error instanceof LotError) return err(error);
      throw error;
    }

    await this.publishEvent(actorUserId, sale, resolvedCtx.lots.length, deletedAt);

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
