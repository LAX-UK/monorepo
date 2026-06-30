import type { CreateLotInput, Lot, Sale } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { LotError } from "../../lib/errors.js";
import { mergeSaleTimingIntoPatch, resolveLotTimingForSale } from "../../lib/lot-sale-timing.js";
import type { LotServiceDeps } from "./lot-types.js";

export const SALE_STATUSES_ALLOWING_LOT_ADD: ReadonlySet<Sale["status"]> = new Set([
  "draft",
  "scheduled",
  "active",
]);

export async function applySaleTimingPolicyToInput(
  deps: LotServiceDeps,
  saleId: string | null,
  input: Pick<CreateLotInput, "startTime" | "endTime"> & Partial<CreateLotInput>,
): Promise<Result<{ input: CreateLotInput; sale: Sale | null }, LotError>> {
  if (saleId == null) {
    return ok({ input: input as CreateLotInput, sale: null });
  }
  if (!deps.saleRepo) {
    return err(new LotError("Sale repository not configured", 500));
  }
  const sale = await deps.saleRepo.findById(saleId);
  if (!sale) {
    return err(new LotError("Sale not found", 404));
  }
  if (!SALE_STATUSES_ALLOWING_LOT_ADD.has(sale.status)) {
    return err(new LotError("Lots can only be added while the sale is draft"));
  }
  const resolved = resolveLotTimingForSale(sale, input.startTime, input.endTime);
  if (!resolved.ok) {
    return err(new LotError(resolved.message, 400));
  }
  return ok({
    input: {
      ...(input as CreateLotInput),
      startTime: resolved.startTime,
      endTime: resolved.endTime,
    },
    sale,
  });
}

export async function applySaleTimingPolicyToLot(
  deps: LotServiceDeps,
  lot: Lot,
  patch: Partial<CreateLotInput>,
): Promise<Result<Partial<CreateLotInput>, LotError>> {
  const saleId = patch.saleId !== undefined ? patch.saleId : lot.saleId;
  if (saleId == null) {
    return ok(patch);
  }
  if (!deps.saleRepo) {
    return err(new LotError("Sale repository not configured", 500));
  }
  const sale = await deps.saleRepo.findById(saleId);
  if (!sale) {
    return err(new LotError("Sale not found", 404));
  }
  const lotStart = patch.startTime ?? lot.startTime;
  const lotEnd = patch.endTime ?? lot.endTime;
  const resolved = resolveLotTimingForSale(sale, lotStart, lotEnd);
  if (!resolved.ok) {
    return err(new LotError(resolved.message, 400));
  }
  return ok(mergeSaleTimingIntoPatch(sale, lot, patch, resolved));
}
