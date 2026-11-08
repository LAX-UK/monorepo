import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { shopDeliveryRegion, shopDeliveryRestrictedCountry } from "./schema/shop-delivery.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0328_shop_delivery_regions.sql");
const rollback = read("0328_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0328 shop delivery regions", () => {
  it("follows 0327 in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0328_shop_delivery_regions");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0327_legal_entity_client_message");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds tables and seed rows, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP\b|\bALTER TABLE\b|\bDELETE\b|\bUPDATE\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "shop_delivery_region"/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "shop_delivery_restricted_country"/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it("seeds lax.bid/shipping's lead times and the UK's current delivery price, once", () => {
    for (const row of [
      "('uk', 5, 10, 10, 20, 1500)",
      "('eu', 10, 15, 15, 25, NULL)",
      "('north_america', 12, 18, 18, 30, NULL)",
      "('asia_pacific', 14, 21, 21, 35, NULL)",
    ]) {
      expect(migration).toContain(row);
    }
    expect(migration).toMatch(/ON CONFLICT \("id"\) DO NOTHING/);
  });

  it("seeds the UK export restrictions list, once", () => {
    expect(migration).toContain("VALUES ('BY'), ('IR'), ('KP'), ('RU'), ('SY')");
    expect(migration).toMatch(/ON CONFLICT \("country_code"\) DO NOTHING/);
  });

  it("is mirrored by the tables' columns", () => {
    expect(Object.keys(getTableColumns(shopDeliveryRegion)).sort()).toEqual([
      "fixedPricePence",
      "id",
      "specialistMaxDays",
      "specialistMinDays",
      "standardMaxDays",
      "standardMinDays",
      "updatedAt",
      "updatedBySubjectId",
    ]);
    expect(getTableColumns(shopDeliveryRegion).fixedPricePence.notNull).toBe(false);
    expect(Object.keys(getTableColumns(shopDeliveryRestrictedCountry)).sort()).toEqual([
      "countryCode",
      "createdAt",
    ]);
  });

  it("is undone by dropping only the two tables", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "shop_delivery_restricted_country"/);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "shop_delivery_region"/);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback.match(/DROP TABLE/g)).toHaveLength(2);
  });
});
