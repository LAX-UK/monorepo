import type { Lot } from "@auction/types";
import { bulkLotDeleteConfirmationPhrase, lotDeleteConfirmationPhrase } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { type AuthzError, LotError } from "../lib/errors.js";
import type { ILotSoftDeleteGuardReader } from "../repositories/interfaces/lot-soft-delete-guard.reader.js";
import type { CatalogSoftDeleteOrchestrator } from "./catalog/catalog-soft-delete-orchestrator.js";
import type {
  ILotSoftDeleteService,
  ILotSoftDeleteSideEffects,
  LotBulkSoftDeleteError,
  LotBulkSoftDeleteResult,
  LotDeleteEligibility,
} from "./interfaces/lot-soft-delete.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import {
  type LotSoftDeleteContext,
  canLotSoftDelete,
  listLotSoftDeleteBlockers,
} from "./lot-soft-delete.policy.js";

export type {
  LotBulkSoftDeleteError,
  LotBulkSoftDeleteResult,
  LotDeleteEligibility,
} from "./interfaces/lot-soft-delete.js";

export class LotSoftDeleteService implements ILotSoftDeleteService {
  constructor(
    private readonly lotRepo: ILotRepository,
    private readonly saleRepo: ISaleRepository,
    private readonly guardReader: ILotSoftDeleteGuardReader,
    private readonly sideEffects: ILotSoftDeleteSideEffects,
    private readonly orchestrator: CatalogSoftDeleteOrchestrator,
  ) {}

  async getDeleteEligibility(lotId: string): Promise<LotDeleteEligibility | null> {
    const lot = await this.lotRepo.findById(lotId);
    if (!lot) return null;

    const sale = lot.saleId ? await this.saleRepo.findById(lot.saleId) : null;
    const guards = await this.guardReader.countGuardsForLot(lotId, lot.saleId);
    const ctx: LotSoftDeleteContext = { lot, sale, guards };
    const blockers = listLotSoftDeleteBlockers(ctx);
    const canDelete = canLotSoftDelete(ctx);

    return {
      canDelete,
      confirmationPhrase: canDelete ? lotDeleteConfirmationPhrase(lot.title) : null,
      blockers,
    };
  }

  async getDeleteEligibilityBatch(lots: Lot[]): Promise<Map<string, LotDeleteEligibility>> {
    const eligibleLots = lots.filter((l) => l.status === "draft" || l.status === "scheduled");
    const result = new Map<string, LotDeleteEligibility>();
    if (eligibleLots.length === 0) return result;

    const saleIds = [
      ...new Set(eligibleLots.map((l) => l.saleId).filter((id): id is string => id != null)),
    ];
    const sales = saleIds.length > 0 ? await this.saleRepo.findByIds(saleIds) : [];
    const saleById = new Map(sales.map((s) => [s.id, s]));

    const guardsByLot = await this.guardReader.countGuardsForLots(
      eligibleLots.map((l) => ({ lotId: l.id, saleId: l.saleId })),
    );

    for (const lot of eligibleLots) {
      const sale = lot.saleId ? (saleById.get(lot.saleId) ?? null) : null;
      const guards = guardsByLot.get(lot.id) ?? {
        bidCount: 0,
        paymentCount: 0,
        approvedRegistrationCount: 0,
      };
      const ctx: LotSoftDeleteContext = { lot, sale, guards };
      const blockers = listLotSoftDeleteBlockers(ctx);
      const canDelete = canLotSoftDelete(ctx);
      result.set(lot.id, {
        canDelete,
        confirmationPhrase: canDelete ? lotDeleteConfirmationPhrase(lot.title) : null,
        blockers,
      });
    }

    return result;
  }

  async softDelete(
    actorUserId: string,
    userRole: string,
    lotId: string,
    confirmationPhrase: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, LotError | AuthzError>> {
    const auth = this.orchestrator.assertAuctionManageCapability(
      userRole,
      "Only staff with auction.manage can delete lots",
      userStaffRole,
    );
    if (auth.isErr()) return err(auth.error);

    const lot = await this.lotRepo.findById(lotId);
    if (!lot) return err(new LotError("Lot not found", 404));

    const expected = lotDeleteConfirmationPhrase(lot.title);
    if (confirmationPhrase !== expected) {
      return err(new LotError(`Type exactly: ${expected}`, 400));
    }

    return this.executeSoftDelete(actorUserId, lot);
  }

  async bulkSoftDelete(
    actorUserId: string,
    userRole: string,
    ids: string[],
    confirmationPhrase: string,
    userStaffRole?: string | null,
  ): Promise<Result<LotBulkSoftDeleteResult, AuthzError | LotError>> {
    const auth = this.orchestrator.assertAuctionManageCapability(
      userRole,
      "Only staff with auction.manage can delete lots",
      userStaffRole,
    );
    if (auth.isErr()) return err(auth.error);

    const expected = bulkLotDeleteConfirmationPhrase(ids.length);
    if (confirmationPhrase !== expected) {
      return err(new LotError(`Type exactly: ${expected}`, 400));
    }

    const lotRows = await Promise.all(ids.map((id) => this.lotRepo.findById(id)));
    const lotsFound = lotRows.filter((lot): lot is Lot => lot != null);
    const saleIds = [
      ...new Set(lotsFound.map((l) => l.saleId).filter((id): id is string => id != null)),
    ];
    const [sales, guardsByLot] = await Promise.all([
      saleIds.length > 0 ? this.saleRepo.findByIds(saleIds) : Promise.resolve([]),
      lotsFound.length > 0
        ? this.guardReader.countGuardsForLots(
            lotsFound.map((l) => ({ lotId: l.id, saleId: l.saleId })),
          )
        : Promise.resolve(new Map()),
    ]);
    const saleById = new Map(sales.map((s) => [s.id, s]));
    const lotsBySaleCache = new Map<string, Lot[]>();

    const errors: LotBulkSoftDeleteError[] = [];
    const orphanDraftSales: Array<{ id: string; title: string }> = [];

    for (const [i, lotId] of ids.entries()) {
      const lot = lotRows[i];
      if (!lot) {
        errors.push({ lotId, message: "Lot not found" });
        continue;
      }

      const sale = lot.saleId ? (saleById.get(lot.saleId) ?? null) : null;
      const guards = guardsByLot.get(lot.id) ?? {
        bidCount: 0,
        paymentCount: 0,
        approvedRegistrationCount: 0,
      };
      const ctx: LotSoftDeleteContext = { lot, sale, guards };
      const blockers = listLotSoftDeleteBlockers(ctx);
      if (!canLotSoftDelete(ctx)) {
        errors.push({
          lotId,
          message: blockers[0] ?? "Lot cannot be deleted",
          ...(blockers.length > 0 ? { blockers } : {}),
        });
        continue;
      }

      let orphanDraftSale: { id: string; title: string } | null = null;
      if (sale?.status === "draft" && lot.saleId) {
        const saleLots = await this.getLotsForSaleCached(lot.saleId, lotsBySaleCache);
        orphanDraftSale = this.checkLastLotInDraftSale(sale, lotId, saleLots);
      }

      const result = await this.executeSoftDelete(actorUserId, lot, ctx);
      if (result.isErr()) {
        errors.push({ lotId, message: result.error.message });
        continue;
      }

      if (orphanDraftSale) {
        orphanDraftSales.push(orphanDraftSale);
      }
      if (lot.saleId) {
        lotsBySaleCache.delete(lot.saleId);
      }
    }

    return ok({
      attempted: ids.length,
      failed: errors.length,
      errors,
      orphanDraftSales,
    });
  }

  private async getLotsForSaleCached(saleId: string, cache: Map<string, Lot[]>): Promise<Lot[]> {
    const cached = cache.get(saleId);
    if (cached) return cached;
    const lots = await this.lotRepo.findBySaleId(saleId);
    cache.set(saleId, lots);
    return lots;
  }

  private checkLastLotInDraftSale(
    sale: { id: string; title: string; status: string },
    lotId: string,
    lots: Lot[],
  ): { id: string; title: string } | null {
    if (sale.status !== "draft") return null;
    const activeLots = lots.filter((l) => !l.deletedAt);
    if (activeLots.length !== 1 || activeLots[0]?.id !== lotId) return null;
    return { id: sale.id, title: sale.title };
  }

  private async executeSoftDelete(
    actorUserId: string,
    lot: Lot,
    ctx?: LotSoftDeleteContext,
  ): Promise<Result<void, LotError>> {
    const resolvedCtx =
      ctx ??
      (await (async () => {
        const sale = lot.saleId ? await this.saleRepo.findById(lot.saleId) : null;
        const guards = await this.guardReader.countGuardsForLot(lot.id, lot.saleId);
        return { lot, sale, guards };
      })());

    return this.orchestrator.executeLotSoftDelete(
      actorUserId,
      lot,
      this.sideEffects,
      ctx,
      resolvedCtx,
    );
  }
}
