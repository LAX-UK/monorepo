import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0194 contract", () => {
  it("adds basket/order price checks without LAX owner backfill", async () => {
    const [forward, rollback, reaudit] = await Promise.all([
      readFile(resolve(drizzle, "0194_shop_phase1_constraints.sql"), "utf8"),
      readFile(resolve(drizzle, "0194_rollback.sql"), "utf8"),
      readFile(resolve(drizzle, "0193_shop_reaudit_holds_payout_authority.sql"), "utf8"),
    ]);
    expect(reaudit).toContain("owner_party_id");
    expect(forward).not.toContain("owner_party_id");
    expect(forward).toContain("lax_platform_seller");
    expect(forward).toContain("NOT VALID");
    expect(forward).toContain("VALIDATE CONSTRAINT");
    expect(forward).toContain("shop_basket_line_quantity_positive");
    expect(forward).toContain("shop_order_line_price_nonnegative");
    expect(rollback).toContain("shop_basket_line_quantity_positive");
    expect(rollback).toContain("irreversible");
  });
});
