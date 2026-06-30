import type { CreateLotInput, Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { LotError } from "../../lib/errors.js";
import { lotNumberConflictError, lotNumberTakenInSale, nextLotNumberInSale } from "./lot-number.js";
import type { LotServiceDeps } from "./lot-types.js";

export async function prepareSaleAssignmentPatch(
  deps: LotServiceDeps,
  lotId: string,
  lot: Lot,
  input: Partial<CreateLotInput>,
): Promise<Result<Partial<CreateLotInput>, LotError>> {
  const patch: Partial<CreateLotInput> = { ...input };

  if (input.saleId === undefined) {
    if (input.lotNumber !== undefined && input.lotNumber !== null && lot.saleId != null) {
      const inSale = await deps.lotRepo.findBySaleId(lot.saleId);
      if (lotNumberTakenInSale(inSale, input.lotNumber, lotId)) {
        return err(lotNumberConflictError());
      }
    }
    return ok(patch);
  }

  if (input.saleId === lot.saleId) {
    if (input.lotNumber !== undefined && input.lotNumber !== null && input.saleId != null) {
      const inSale = await deps.lotRepo.findBySaleId(input.saleId);
      if (lotNumberTakenInSale(inSale, input.lotNumber, lotId)) {
        return err(lotNumberConflictError());
      }
    }
    return ok(patch);
  }

  if (input.saleId === null) {
    if (lot.saleId != null) {
      if (!deps.saleRepo) {
        return err(new LotError("Sale repository not configured", 500));
      }
      const sourceSale = await deps.saleRepo.findById(lot.saleId);
      if (!sourceSale) {
        return err(new LotError("Sale not found", 404));
      }
      if (sourceSale.status !== "draft") {
        return err(new LotError("Lots can only be detached while the sale is draft"));
      }
      if (lot.status !== "draft") {
        return err(new LotError("Only draft lots can be moved between sales"));
      }
    }
    patch.lotNumber = null;
    return ok(patch);
  }

  if (!deps.saleRepo) {
    return err(new LotError("Sale repository not configured", 500));
  }

  const sale = await deps.saleRepo.findById(input.saleId);
  if (!sale) {
    return err(new LotError("Sale not found", 404));
  }
  if (sale.status !== "draft") {
    return err(new LotError("Lots can only be attached while the sale is draft"));
  }
  if (input.saleId !== lot.saleId && lot.status !== "draft") {
    return err(new LotError("Only draft lots can be moved between sales"));
  }
  if (lot.saleId != null && lot.saleId !== input.saleId) {
    const sourceSale = await deps.saleRepo.findById(lot.saleId);
    if (!sourceSale) {
      return err(new LotError("Sale not found", 404));
    }
    if (sourceSale.status !== "draft") {
      return err(new LotError("Lots can only be detached while the sale is draft"));
    }
  }

  const inSale = await deps.lotRepo.findBySaleId(input.saleId);
  const requestedNumber =
    input.lotNumber !== undefined && input.lotNumber !== null ? input.lotNumber : undefined;

  if (requestedNumber !== undefined) {
    if (lotNumberTakenInSale(inSale, requestedNumber, lotId)) {
      return err(lotNumberConflictError());
    }
    patch.lotNumber = requestedNumber;
  } else {
    patch.lotNumber = nextLotNumberInSale(inSale, lotId);
  }

  return ok(patch);
}
