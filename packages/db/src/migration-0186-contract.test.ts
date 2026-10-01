import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0186 contract", () => {
  it("adds fulfilment and production tables with rollback", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0186_shop_fulfilment_production.sql"), "utf8"),
      readFile(resolve(drizzle, "0186_rollback.sql"), "utf8"),
    ]);
    expect(forward).toContain("shop_fulfilment_option_price");
    expect(forward).toContain("shop_production_task");
    expect(forward).toContain("shop_certificate");
    expect(rollback).toContain('DROP TABLE IF EXISTS "shop_fulfilment"');
  });
});
