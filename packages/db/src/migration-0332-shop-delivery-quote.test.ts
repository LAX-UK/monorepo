import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { shopDeliveryQuote } from "./schema/shop-delivery.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0332_shop_delivery_quote.sql");
const rollback = read("0332_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0332 shop delivery quote", () => {
  it("follows the migration before it in the journal, later in time", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0332_shop_delivery_quote");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("only adds one table and its indexes, with a short lock timeout", () => {
    const statements = migration.replace("ON DELETE RESTRICT", "");
    expect(statements).not.toMatch(/\bDROP\b|\bALTER TABLE\b|\bDELETE\b|\bUPDATE\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "shop_delivery_quote"/);
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "shop_delivery_quote_order_uid"/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it("holds the saleroom's four quote steps and the three ways a request ends", () => {
    expect(migration).toContain("IN ('requested', 'quoted', 'accepted', 'withdrawn')");
    expect(migration).toContain("IN ('cancelled_by_buyer', 'cannot_deliver', 'expired')");
  });

  it("lets a withdrawn quote, and only a withdrawn one, carry an end reason", () => {
    expect(migration).toContain(`("status" = 'withdrawn') = ("end_reason" IS NOT NULL)`);
  });

  it("refuses a quoted price that is not a positive amount, and a UK region", () => {
    expect(migration).toContain(`"quoted_price_pence" > 0`);
    expect(migration).toContain(`IN ('eu', 'north_america', 'asia_pacific')`);
  });

  it("keeps an order's prints with the order: no cascade", () => {
    expect(migration).toContain(`REFERENCES "shop_order"("id") ON DELETE RESTRICT`);
  });

  it("is mirrored by the table's columns", () => {
    expect(Object.keys(getTableColumns(shopDeliveryQuote)).sort()).toEqual([
      "createdAt",
      "decidedAt",
      "destinationCountry",
      "endReason",
      "holdUntil",
      "id",
      "orderId",
      "quotedAt",
      "quotedBySubjectId",
      "quotedLeadTimeNote",
      "quotedPricePence",
      "quotedService",
      "regionId",
      "requestedAt",
      "status",
      "updatedAt",
    ]);
  });

  it("has a rollback that drops only that table", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "shop_delivery_quote"/);
    expect(rollback.match(/DROP TABLE/g)).toHaveLength(1);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
  });
});
