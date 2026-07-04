import type { ISaleSoftDeleteGuardReader } from "@auction/persistence/interfaces";
import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import {
  bulkSaleDeleteConfirmationPhrase,
  saleDeleteConfirmationPhrase,
} from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { type AuthzError, LotError } from "../lib/errors.js";
import type { CatalogSoftDeleteOrchestrator } from "./catalog/catalog-soft-delete-orchestrator.js";
import type {
  ISaleSoftDeleteService,
  ISaleSoftDeleteSideEffects,
  SaleBulkSoftDeleteError,
  SaleBulkSoftDeleteResult,
  SaleDeleteEligibility,
} from "./interfaces/sale-soft-delete.js";
import {
  type SaleSoftDeleteContext,
  canSaleSoftDelete,
  listSaleSoftDeleteBlockers,
} from "./sale-soft-delete.policy.js";

export type {
  SaleBulkSoftDeleteError,
  SaleBulkSoftDeleteResult,
  SaleDeleteEligibility,
} from "./interfaces/sale-soft-delete.js";

export class SaleSoftDeleteService implements ISaleSoftDeleteService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly guardReader: ISaleSoftDeleteGuardReader,
    private readonly sideEffects: ISaleSoftDeleteSideEffects,
    private readonly orchestrator: CatalogSoftDeleteOrchestrator,
  ) {}

  async getDeleteEligibility(saleId: string): Promise<SaleDeleteEligibility | null> {
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return null;

    const lots = await this.lotRepo.findBySaleId(saleId);
    const guards = await this.guardReader.countGuardsForSale(saleId);
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
    const guardsBySale = await this.guardReader.countGuardsForSales(saleIds);

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
    const auth = this.orchestrator.assertAuctionManageCapability(
      userRole,
      "Only staff with auction.manage can delete sales",
      userStaffRole,
    );
    if (auth.isErr()) return err(auth.error);

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
    const auth = this.orchestrator.assertAuctionManageCapability(
      userRole,
      "Only staff with auction.manage can delete sales",
      userStaffRole,
    );
    if (auth.isErr()) return err(auth.error);

    const expected = bulkSaleDeleteConfirmationPhrase(ids.length);
    if (confirmationPhrase !== expected) {
      return err(new LotError(`Type exactly: ${expected}`, 400));
    }

    const saleRows = await Promise.all(ids.map((id) => this.saleRepo.findById(id)));
    const salesFound = saleRows.filter((sale): sale is Sale => sale != null);
    const guardsBySale =
      salesFound.length > 0
        ? await this.guardReader.countGuardsForSales(salesFound.map((s) => s.id))
        : new Map();
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
        const guards = await this.guardReader.countGuardsForSale(sale.id);
        return { sale, lots, guards };
      })());

    return this.orchestrator.executeSaleSoftDelete(
      actorUserId,
      sale,
      this.sideEffects,
      ctx,
      resolvedCtx,
    );
  }
}
