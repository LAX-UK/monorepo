import type { Lot } from "@auction/types";
import { normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import type { CreateNestedLotForSaleInput } from "@auction/validators";
import { englishOnlyAdminLotAuctionTypeViolation } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { LotAttachedToSalePayload } from "../../domain/lot-events.js";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import {
  emergencyAddPublishFailedError,
  resolveLotNumberForEmergencyAdd,
  rollbackFailedEmergencyLotAdd,
} from "../../lib/emergency-lot-add.js";
import { type AuthzError, LotError, missingCatalogueCapabilityError } from "../../lib/errors.js";
import { resolveLotTimingForSale } from "../../lib/lot-sale-timing.js";
import { publishSingleLot } from "../../lib/publish-single-lot.js";
import { publishSingleLotDeps, recordLotLifecycle, txRepos } from "./sale-mutation-context.js";
import { SALE_STATUSES_ALLOWING_LOT_ADD, mapSaleAddLotDbError } from "./sale-status-policy.js";
import type { SaleServiceDeps } from "./sale-types.js";

export async function addLotToSale(
  deps: SaleServiceDeps,
  userRole: string,
  saleId: string,
  row: CreateNestedLotForSaleInput,
  userStaffRole?: string | null,
): Promise<Result<Lot, LotError | AuthzError>> {
  const role = normalizeUserRoleOrClient(userRole);
  const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
  if (!canManageCatalogue(role, staff)) {
    return err(
      missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can add lots to a sale",
        role,
        staff,
      ),
    );
  }
  const sale = await deps.saleRepo.findById(saleId);
  if (!sale) return err(new LotError("Sale not found", 404));
  if (!SALE_STATUSES_ALLOWING_LOT_ADD.has(sale.status)) {
    return err(new LotError("Lots can only be added while the sale is draft"));
  }
  const { sellerId, ...lotFields } = row;
  const resolved = resolveLotTimingForSale(sale, lotFields.startTime, lotFields.endTime);
  if (!resolved.ok) {
    return err(new LotError(resolved.message, 400));
  }
  if (resolved.endTime <= resolved.startTime) {
    return err(new LotError("endTime must be after startTime"));
  }
  const lockMsg = englishOnlyAdminLotAuctionTypeViolation({
    enabled: deps.englishOnlyAuctions,
    requested: row.auctionType,
  });
  if (lockMsg) {
    return err(new LotError(lockMsg));
  }
  const inSaleLots = await deps.lotRepo.findBySaleId(saleId);
  const lotNumber = resolveLotNumberForEmergencyAdd({
    sale,
    requestedLotNumber: lotFields.lotNumber,
    inSaleLots,
  });
  const createdSource =
    sale.status === "draft" ? ("sale_create" as const) : ("emergency_add" as const);
  const createFields = {
    ...lotFields,
    sellerLegalEntityId: sellerId,
    startTime: resolved.startTime,
    endTime: resolved.endTime,
    saleId,
    ...(lotNumber !== undefined ? { lotNumber } : {}),
  };
  let created: Lot;
  if (deps.transactionRunner && deps.lotLifecycleRecording) {
    try {
      created = await deps.transactionRunner.runInTransaction(async (tx) => {
        const lotRepo = txRepos(deps, tx).lot;
        const row = await lotRepo.create(createFields);
        await deps.lotLifecycleRecording?.recordCreated(tx, { lot: row, source: createdSource });
        return row;
      });
    } catch (e) {
      const mapped = mapSaleAddLotDbError(e);
      if (mapped) return err(mapped);
      throw e;
    }
  } else {
    try {
      created = await deps.lotRepo.create(createFields);
    } catch (e) {
      const mapped = mapSaleAddLotDbError(e);
      if (mapped) return err(mapped);
      throw e;
    }
    await recordLotLifecycle(deps, async (tx) => {
      await deps.lotLifecycleRecording?.recordCreated(tx, {
        lot: created,
        source: createdSource,
      });
    });
  }
  if (sale.status !== "draft") {
    const published = await publishSingleLot({ lot: created, sale }, publishSingleLotDeps(deps));
    if (published.isErr()) {
      await rollbackFailedEmergencyLotAdd(created, publishSingleLotDeps(deps));
      return err(emergencyAddPublishFailedError(published.error, created.id, true));
    }
    return ok(published.value);
  }
  return ok(created);
}

export async function attachExistingLotToSale(
  deps: SaleServiceDeps,
  userRole: string,
  saleId: string,
  lotId: string,
  userStaffRole?: string | null,
  attachVia: LotAttachedToSalePayload["via"] = "attach_endpoint",
): Promise<Result<Lot, LotError | AuthzError>> {
  const role = normalizeUserRoleOrClient(userRole);
  const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
  if (!canManageCatalogue(role, staff)) {
    return err(
      missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can attach lots",
        role,
        staff,
      ),
    );
  }
  const sale = await deps.saleRepo.findById(saleId);
  if (!sale) return err(new LotError("Sale not found", 404));
  if (sale.status !== "draft") {
    return err(new LotError("Lots can only be attached while the sale is draft"));
  }
  const existingLot = await deps.lotRepo.findById(lotId);
  if (!existingLot) return err(new LotError("Lot not found", 404));
  if (existingLot.status !== "draft") {
    return err(new LotError("Only draft standalone lots can be attached"));
  }
  if (existingLot.saleId != null) {
    return err(new LotError("Lot already belongs to a sale"));
  }
  const inSale = await deps.lotRepo.findBySaleId(saleId);
  const maxNum = inSale.reduce((m, l) => Math.max(m, l.lotNumber ?? 0), 0);
  const lotNumber = maxNum + 1;
  const resolved = resolveLotTimingForSale(sale, existingLot.startTime, existingLot.endTime);
  if (!resolved.ok) {
    return err(new LotError(resolved.message, 400));
  }
  let updated: Lot;
  if (deps.transactionRunner && deps.lotLifecycleRecording) {
    updated = await deps.transactionRunner.runInTransaction(async (tx) => {
      const lotRepo = txRepos(deps, tx).lot;
      const row = await lotRepo.update(lotId, {
        saleId,
        lotNumber,
        startTime: resolved.startTime,
        endTime: resolved.endTime,
      });
      await deps.lotLifecycleRecording?.recordAttached(tx, existingLot, {
        saleId,
        lotNumber,
        fromSaleId: null,
        via: attachVia,
      });
      return row;
    });
  } else {
    updated = await deps.lotRepo.update(lotId, {
      saleId,
      lotNumber,
      startTime: resolved.startTime,
      endTime: resolved.endTime,
    });
    await recordLotLifecycle(deps, async (tx) => {
      await deps.lotLifecycleRecording?.recordAttached(tx, existingLot, {
        saleId,
        lotNumber,
        fromSaleId: null,
        via: attachVia,
      });
    });
  }
  return ok(updated);
}

export async function detachLotFromSale(
  deps: SaleServiceDeps,
  userRole: string,
  saleId: string,
  lotId: string,
  userStaffRole?: string | null,
): Promise<Result<void, LotError | AuthzError>> {
  const role = normalizeUserRoleOrClient(userRole);
  const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
  if (!canManageCatalogue(role, staff)) {
    return err(
      missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can detach lots",
        role,
        staff,
      ),
    );
  }
  const sale = await deps.saleRepo.findById(saleId);
  if (!sale) return err(new LotError("Sale not found", 404));
  if (sale.status !== "draft") {
    return err(new LotError("Lots can only be detached while the sale is draft"));
  }
  const l = await deps.lotRepo.findById(lotId);
  if (!l || l.saleId !== saleId) {
    return err(new LotError("Lot not found in this sale", 404));
  }
  if (l.status !== "draft") {
    return err(new LotError("Only draft lots can be moved between sales"));
  }
  const fromSaleId = l.saleId;
  if (deps.transactionRunner && deps.lotLifecycleRecording) {
    await deps.transactionRunner.runInTransaction(async (tx) => {
      const lotRepo = txRepos(deps, tx).lot;
      await lotRepo.clearSaleId(lotId);
      await deps.lotLifecycleRecording?.recordDetached(tx, l, fromSaleId);
    });
  } else {
    await deps.lotRepo.clearSaleId(lotId);
    await recordLotLifecycle(deps, async (tx) => {
      await deps.lotLifecycleRecording?.recordDetached(tx, l, fromSaleId);
    });
  }
  return ok(undefined);
}
