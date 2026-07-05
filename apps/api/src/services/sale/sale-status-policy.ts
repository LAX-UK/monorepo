import { SALE_CANCELLABLE, SALE_STATUSES_ALLOWING_LOT_ADD } from "@auction/domain";
import { LotError } from "../../lib/errors.js";
import { findPostgresError } from "../../lib/pg-error.js";

export { SALE_CANCELLABLE, SALE_STATUSES_ALLOWING_LOT_ADD };

export const LOT_NUMBER_CONFLICT_MSG =
  "Lot number already used in that sale — pick a different number or leave it blank to auto-assign.";

export function mapSaleAddLotDbError(error: unknown): LotError | null {
  const pg = findPostgresError(error);
  if (
    pg?.code === "23505" &&
    (pg.message.includes("lot_sale_id_lot_number") ||
      pg.message.includes("lot_sale_id_lot_number_uid"))
  ) {
    return new LotError(LOT_NUMBER_CONFLICT_MSG, 400);
  }
  return null;
}
