import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { shopPrintException } from "./schema/shop-commerce.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0337_shop_print_exception.sql");
const rollback = read("0337_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0337 shop print exception", () => {
  it("follows 0330 in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0337_shop_print_exception");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0330_shop_print_facts");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only widens four run rules and adds one table", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN/);
    for (const rule of ["vocabulary", "size", "template", "link"]) {
      expect(migration).toContain(`ADD CONSTRAINT "shop_artwork_run_${rule}_ck"`);
    }
    expect(migration).toMatch(/'main', 'proof', 'companion', 'set_apart'/);
  });

  it("holds a print set apart to one print, with no proof type and no template", () => {
    expect(migration).toMatch(/"run_role" IN \('proof', 'set_apart'\) THEN 1 ELSE 2/);
    expect(migration).toMatch(
      /"run_role" NOT IN \('proof', 'set_apart'\) OR "run_template" IS NULL/,
    );
    expect(migration).toMatch(/\("run_role" = 'proof'\) = \("proof_type" IS NOT NULL\)/);
  });

  it("needs at least one difference and keeps one open record per print", () => {
    expect(migration).toMatch(/shop_print_exception_difference_ck/);
    expect(migration).toMatch(
      /"shop_print_exception_open_edition_uid"\s+ON "shop_print_exception" \("edition_id"\) WHERE "returned_at" IS NULL/,
    );
    const columns = getTableColumns(shopPrintException);
    expect(columns.setApartBySubjectId.notNull).toBe(true);
    expect(columns.returnedAt.notNull).toBe(false);
  });

  it("is undone by dropping only what it added, and refuses while prints are set apart", () => {
    expect(rollback).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toMatch(/"run_role" = 'set_apart'/);
    expect(rollback).toMatch(/RAISE EXCEPTION/);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "shop_print_exception"/);
    expect(rollback).toMatch(/'main', 'proof', 'companion'\)/);
    expect(rollback).not.toMatch(/'set_apart'\)\s*\)/);
  });
});
