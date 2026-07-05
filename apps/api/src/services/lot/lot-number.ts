import { LotError } from "../../lib/errors.js";
import { findPostgresError } from "../../lib/pg-error.js";

export { lotNumberTakenInSale, nextLotNumberInSale } from "@auction/domain";

export const LOT_NUMBER_CONFLICT_MSG =
  "Lot number already used in that sale — pick a different number or leave it blank to auto-assign.";

export function lotNumberConflictError(): LotError {
  return new LotError(LOT_NUMBER_CONFLICT_MSG, 400);
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
