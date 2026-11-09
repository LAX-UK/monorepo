import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { SHOP_COMMERCE_TABLES } from "./migrate-roles.js";
import { shopOrder, shopOrderLine } from "./schema/shop-commerce.js";
import { shopFramingTask } from "./schema/shop-framing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0342_shop_framing_orders.sql");
const rollback = read("0342_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0342 shop framing orders", () => {
  it("follows an earlier migration in the journal, with the next index and a later time", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0342_shop_framing_orders");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(Number(previous?.tag.slice(0, 4))).toBeLessThan(342);
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("only adds columns and a table, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS "framing_subtotal_pence" integer DEFAULT 0 NOT NULL',
    );
    expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'goods' NOT NULL`);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "shop_framing_task"/);
  });

  it("makes every existing line goods, so existing rows keep passing", () => {
    expect(migration).toContain(`"kind" text DEFAULT 'goods' NOT NULL`);
  });

  it("keeps a framing line apart from editions, products, artworks and sellers", () => {
    const check = migration.slice(migration.indexOf('ADD CONSTRAINT "shop_order_line_target_xor"'));
    expect(check).toContain(`"kind" = 'framing'`);
    for (const column of ["edition_id", "product_variant_id", "artwork_id", "seller_party_id"]) {
      expect(check).toContain(`"${column}" IS NULL`);
    }
    for (const column of ["framing_for_line_id", "framing_option_id", "framing_snapshot"]) {
      expect(check).toContain(`"${column}" IS NOT NULL`);
    }
    // And a goods line keeps the old rule: exactly one of edition or variant, nothing of framing.
    expect(check).toContain(
      `(("edition_id" IS NOT NULL)::int + ("product_variant_id" IS NOT NULL)::int) = 1`,
    );
  });

  it("adds the replacement check without locking the table to scan it", () => {
    expect(migration).toMatch(/\) NOT VALID;/);
    expect(migration).toContain('VALIDATE CONSTRAINT "shop_order_line_target_xor"');
  });

  it("allows one framing line per print line", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_line_framing_parent_uid"',
    );
  });

  it("holds a framing line as sold: the option, price and snapshot cannot change", () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION "shop_order_line_framing_fixed"()');
    for (const column of [
      "framing_snapshot",
      "framing_option_id",
      "framing_for_line_id",
      "unit_price_pence",
    ]) {
      expect(migration).toContain(`NEW."${column}" IS DISTINCT FROM OLD."${column}"`);
    }
    expect(migration).toContain('BEFORE UPDATE ON "shop_order_line"');
  });

  it("gives each framing line one task of its own, tied to the line and not to an edition", () => {
    const table = migration.slice(
      migration.indexOf('CREATE TABLE IF NOT EXISTS "shop_framing_task"'),
    );
    expect(table).toContain(
      'CONSTRAINT "shop_framing_task_order_line_uid" UNIQUE ("order_line_id")',
    );
    expect(table).toContain('REFERENCES "shop_order_line" ("id")');
    expect(table).not.toContain("edition_id");
    expect(table).toContain(`'queued', 'framing', 'framed', 'completed', 'cancelled'`);
    expect(table).toContain('"due_at" timestamp with time zone NOT NULL');
  });

  it("is mirrored by the schema and granted to the shop role", () => {
    expect(getTableColumns(shopOrder).framingSubtotalPence.notNull).toBe(true);
    const line = getTableColumns(shopOrderLine);
    expect(line.kind.notNull).toBe(true);
    expect(line.framingForLineId.notNull).toBe(false);
    expect(line.framingSnapshot.notNull).toBe(false);
    expect(getTableName(shopFramingTask)).toBe("shop_framing_task");
    expect([...SHOP_COMMERCE_TABLES]).toContain("shop_framing_task");
  });

  it("is undone only while no framing line exists, since those are money records", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toMatch(/lock_timeout = '5s'/);
    const guard = rollback.indexOf(`WHERE "kind" = 'framing'`);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(rollback.indexOf('DROP TABLE IF EXISTS "shop_framing_task"'));
    expect(rollback).toContain("RAISE EXCEPTION");
    expect(rollback).toContain(
      `CHECK ((("edition_id" IS NOT NULL)::int + ("product_variant_id" IS NOT NULL)::int) = 1)`,
    );
    for (const column of ["kind", "framing_for_line_id", "framing_option_id", "framing_snapshot"]) {
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
    expect(rollback).toContain('DROP COLUMN IF EXISTS "framing_subtotal_pence"');
  });
});
