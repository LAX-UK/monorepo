import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0193 contract", () => {
  it("adds unique active hold index and payout or authority backfill", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0193_shop_reaudit_holds_payout_authority.sql"), "utf8"),
      readFile(resolve(drizzle, "0193_rollback.sql"), "utf8"),
    ]);
    expect(forward).toContain("shop_stock_hold_edition_active_uid");
    expect(forward).toContain('INSERT INTO "shop_fulfilment"');
    expect(forward).toContain("pending_possession");
    expect(forward).not.toContain("lax_platform_seller");
    expect(forward).toContain("shop_sale_authority_grant");
    expect(rollback).toContain("irreversible");
    expect(rollback).toContain("shop_stock_hold_edition_active_idx");
  });
});
