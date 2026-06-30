import { describe, expect, it } from "vitest";
import { LotError } from "../../lib/errors.js";
import {
  LOT_NUMBER_CONFLICT_MSG,
  SALE_CANCELLABLE,
  SALE_STATUSES_ALLOWING_LOT_ADD,
  mapSaleAddLotDbError,
} from "./sale-status-policy.js";

describe("sale-status-policy", () => {
  it("SALE_CANCELLABLE includes draft, scheduled, active", () => {
    expect(SALE_CANCELLABLE.has("draft")).toBe(true);
    expect(SALE_CANCELLABLE.has("scheduled")).toBe(true);
    expect(SALE_CANCELLABLE.has("active")).toBe(true);
    expect(SALE_CANCELLABLE.has("ended")).toBe(false);
  });

  it("SALE_STATUSES_ALLOWING_LOT_ADD includes draft, scheduled, active", () => {
    expect(SALE_STATUSES_ALLOWING_LOT_ADD.has("draft")).toBe(true);
    expect(SALE_STATUSES_ALLOWING_LOT_ADD.has("scheduled")).toBe(true);
    expect(SALE_STATUSES_ALLOWING_LOT_ADD.has("active")).toBe(true);
  });

  it("mapSaleAddLotDbError maps lot number unique violation", () => {
    const pgErr = new Error(
      "duplicate key value violates unique constraint lot_sale_id_lot_number",
    );
    (pgErr as Error & { code: string }).code = "23505";
    const err = mapSaleAddLotDbError(pgErr);
    expect(err).toBeInstanceOf(LotError);
    expect(err?.message).toBe(LOT_NUMBER_CONFLICT_MSG);
    expect(err?.status).toBe(400);
  });

  it("mapSaleAddLotDbError returns null for unrelated errors", () => {
    expect(mapSaleAddLotDbError(new Error("other"))).toBeNull();
  });
});
