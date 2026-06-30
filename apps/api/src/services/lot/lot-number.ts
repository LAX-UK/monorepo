import type { Lot } from "@auction/types";
import { LotError } from "../../lib/errors.js";
import { findPostgresError } from "../../lib/pg-error.js";

export const LOT_NUMBER_CONFLICT_MSG =
  "Lot number already used in that sale — pick a different number or leave it blank to auto-assign.";

export function lotNumberConflictError(): LotError {
  return new LotError(LOT_NUMBER_CONFLICT_MSG, 400);
}

export function lotNumberTakenInSale(
  lots: Lot[],
  lotNumber: number,
  excludeLotId: string,
): boolean {
  return lots.some((l) => l.id !== excludeLotId && l.lotNumber === lotNumber);
}

export function nextLotNumberInSale(lots: Lot[], excludeLotId: string): number {
  const maxNum = lots
    .filter((l) => l.id !== excludeLotId)
    .reduce((m, l) => Math.max(m, l.lotNumber ?? 0), 0);
  return maxNum + 1;
}

export function mapLotNumberConstraintError(error: unknown): LotError | null {
  const pg = findPostgresError(error);
  if (
    pg?.code === "23505" &&
    (pg.message.includes("lot_sale_id_lot_number") ||
      pg.message.includes("lot_sale_id_lot_number_uid"))
  ) {
    return lotNumberConflictError();
  }
  return null;
}

/** @deprecated use {@link mapLotNumberConstraintError} — kept for call-sites in update path */
export const mapLotUpdateDbError = mapLotNumberConstraintError;
