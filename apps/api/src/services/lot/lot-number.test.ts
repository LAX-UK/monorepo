import { describe, expect, it } from "vitest";
import { LotError } from "../../lib/errors.js";
import {
  LOT_NUMBER_CONFLICT_MSG,
  mapLotNumberConstraintError,
  mapLotUpdateDbError,
  nextLotNumberInSale,
} from "./lot-number.js";

describe("lot-number", () => {
  it("mapLotNumberConstraintError maps lot number unique violation", () => {
    const pgErr = new Error(
      "duplicate key value violates unique constraint lot_sale_id_lot_number",
    );
    (pgErr as Error & { code: string }).code = "23505";
    const err = mapLotNumberConstraintError(pgErr);
    expect(err).toBeInstanceOf(LotError);
    expect(err?.message).toBe(LOT_NUMBER_CONFLICT_MSG);
    expect(err?.status).toBe(400);
  });

  it("mapLotNumberConstraintError returns null for unrelated errors", () => {
    expect(mapLotNumberConstraintError(new Error("other"))).toBeNull();
  });

  it("mapLotUpdateDbError is an alias for mapLotNumberConstraintError", () => {
    const pgErr = new Error(
      "duplicate key value violates unique constraint lot_sale_id_lot_number_uid",
    );
    (pgErr as Error & { code: string }).code = "23505";
    expect(mapLotUpdateDbError(pgErr)?.message).toBe(LOT_NUMBER_CONFLICT_MSG);
  });

  it("nextLotNumberInSale excludes self and returns max + 1", () => {
    const lots = [
      { id: "a", lotNumber: 3 },
      { id: "b", lotNumber: 7 },
      { id: "c", lotNumber: null },
    ] as never[];
    expect(nextLotNumberInSale(lots, "a")).toBe(8);
  });
});
