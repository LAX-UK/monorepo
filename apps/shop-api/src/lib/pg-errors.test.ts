import { describe, expect, it } from "vitest";
import { isPgUniqueViolation, pgUniqueViolationConstraint } from "./pg-errors.js";

describe("pg-errors", () => {
  it("detects unique violations and constraint names", () => {
    const error = { code: "23505", constraint: "shop_order_idempotency_key_uid" };
    expect(isPgUniqueViolation(error)).toBe(true);
    expect(pgUniqueViolationConstraint(error)).toBe("shop_order_idempotency_key_uid");
  });

  it("walks nested causes", () => {
    const error = { cause: { code: "23505", constraint: "shop_order_line_edition_active_uid" } };
    expect(pgUniqueViolationConstraint(error)).toBe("shop_order_line_edition_active_uid");
  });
});
